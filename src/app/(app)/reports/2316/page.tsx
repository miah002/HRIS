import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { php } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { ChevronLeft, FileText } from "lucide-react";
import { YearNav } from "./year-nav";

export default async function BIR2316ListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()));

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
    include: {
      payrolls: {
        where: { periodStart: { gte: yearStart }, periodEnd: { lte: yearEnd } },
      },
    },
    orderBy: [{ department: "asc" }, { lastName: "asc" }],
  });

  const rows = employees.map((e) => {
    const gross = e.payrolls.reduce((s, p) => s + p.grossPay, 0);
    const sss   = e.payrolls.reduce((s, p) => s + p.sssEE, 0);
    const phic  = e.payrolls.reduce((s, p) => s + p.philHealthEE, 0);
    const hdmf  = e.payrolls.reduce((s, p) => s + p.pagIbigEE, 0);
    const wht   = e.payrolls.reduce((s, p) => s + p.withholdingTax, 0);
    const nonTax = e.payrolls.reduce((s, p) => s + p.nonTaxableAdjustments, 0);
    const taxable = Math.max(gross - sss - phic - hdmf - Math.min(nonTax, 90000), 0);
    return { employee: e, gross, taxable, wht, periods: e.payrolls.length };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Reports
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">BIR Form 2316</h1>
        <p className="text-sm text-[var(--text-secondary)]">Certificate of Compensation Payment / Tax Withheld · Calendar Year {year}</p>
      </div>

      <YearNav year={year} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--brand)]" />
            {rows.length} employees · Click name to open individual 2316
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th className="text-center w-20">Periods</Th>
                <Th numeric>Gross Comp.</Th>
                <Th numeric>Taxable</Th>
                <Th numeric>Tax Withheld</Th>
                <Th className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ employee: e, gross, taxable, wht, periods }) => (
                <TableRow key={e.id}>
                  <Td>
                    <Link
                      href={`/employees/${e.id}/2316?year=${year}`}
                      className="font-medium text-xs text-[var(--brand)] hover:underline"
                    >
                      {e.lastName}, {e.firstName}
                    </Link>
                    <div className="text-[10px] text-[var(--text-tertiary)]">{e.employeeNumber} · {e.tin ?? "No TIN"}</div>
                  </Td>
                  <Td className="text-xs">{e.department}</Td>
                  <Td className="text-center text-xs">{periods}</Td>
                  <Td numeric className="text-xs">{php(gross)}</Td>
                  <Td numeric className="text-xs">{php(taxable)}</Td>
                  <Td numeric className="text-xs font-semibold">{php(wht)}</Td>
                  <Td>
                    <Link
                      href={`/employees/${e.id}/2316?year=${year}`}
                      className="text-[10px] text-[var(--brand)] hover:underline"
                    >
                      View →
                    </Link>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--text-tertiary)]">
        Values derived from payroll records. Verify totals against actual payroll registers before issuing to employees or submitting to BIR. Issue to employees on or before January 31; submit copies to BIR/RDO by February 28 of the following year.
      </p>
    </div>
  );
}
