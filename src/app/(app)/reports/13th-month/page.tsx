import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { php } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
import { ChevronLeft } from "lucide-react";
import { YearPicker } from "./year-picker";
import { CsvExport } from "./csv-export";

export default async function ThirteenthMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()));

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
    const totalBasic = e.payrolls.reduce((s, p) => s + p.basicPay, 0);
    const thirteenthMonth = totalBasic / 12;
    // Tax-exempt up to ₱90,000 (combined with other benefits; here we only track 13th month)
    const exempt = Math.min(thirteenthMonth, 90000);
    const taxable = Math.max(thirteenthMonth - 90000, 0);
    return {
      employee: e,
      payrollCount: e.payrolls.length,
      totalBasic,
      thirteenthMonth,
      exempt,
      taxable,
    };
  });

  const grandTotal = rows.reduce((s, r) => s + r.thirteenthMonth, 0);

  const csvData = rows.map((r) => [
    r.employee.employeeNumber,
    `${r.employee.lastName}, ${r.employee.firstName}`,
    r.employee.department,
    r.employee.position,
    r.payrollCount.toString(),
    r.totalBasic.toFixed(2),
    r.thirteenthMonth.toFixed(2),
    r.exempt.toFixed(2),
    r.taxable.toFixed(2),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Reports
        </Link>
        <CsvExport
          filename={`13thMonth-${year}.csv`}
          headers={["Emp No.", "Name", "Department", "Position", "Pay Periods", "Total Basic Earned", "13th Month Due", "Tax-Exempt", "Taxable"]}
          rows={csvData}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold">13th Month Pay</h1>
        <p className="text-sm text-[var(--text-secondary)]">Calendar year {year} · Based on basic pay earned per payroll records</p>
      </div>

      <YearPicker year={year} />

      <div className="grid sm:grid-cols-3 gap-3">
        <InfoCard label="Employees covered" value={String(rows.filter(r => r.payrollCount > 0).length)} />
        <InfoCard label="Total 13th month due" value={php(grandTotal)} />
        <InfoCard label="Within ₱90k exempt cap" value={php(rows.reduce((s, r) => s + r.exempt, 0))} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th numeric>Pay Periods</Th>
                <Th numeric>Total Basic Earned</Th>
                <Th numeric>÷ 12 = 13th Month</Th>
                <Th numeric>Tax-Exempt</Th>
                <Th numeric>Taxable Excess</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee.id}>
                  <Td>
                    <div className="font-medium text-xs">{r.employee.lastName}, {r.employee.firstName}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">{r.employee.employeeNumber}</div>
                  </Td>
                  <Td className="text-xs">{r.employee.department}</Td>
                  <Td numeric className="text-xs">{r.payrollCount}</Td>
                  <Td numeric className="text-xs">{php(r.totalBasic)}</Td>
                  <Td numeric className="font-semibold text-xs">{php(r.thirteenthMonth)}</Td>
                  <Td numeric className="text-xs text-[var(--text-secondary)]">{php(r.exempt)}</Td>
                  <Td numeric className="text-xs text-[var(--text-secondary)]">
                    {r.taxable > 0 ? php(r.taxable) : "—"}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <Td colSpan={4} className="text-xs font-semibold">Grand Total</Td>
                <Td numeric className="font-bold text-xs text-[var(--brand)]">{php(grandTotal)}</Td>
                <Td numeric className="font-semibold text-xs">{php(rows.reduce((s, r) => s + r.exempt, 0))}</Td>
                <Td numeric className="font-semibold text-xs">{php(rows.reduce((s, r) => s + r.taxable, 0))}</Td>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--text-tertiary)]">
        Note: Tax-exempt column shows the portion within the ₱90,000 combined cap (PD 851 / TRAIN Law). If the employee also received bonuses in the same year, the actual exempt amount may be lower. Release on or before December 24 per PD 851.
      </p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-4">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </CardContent></Card>
  );
}
