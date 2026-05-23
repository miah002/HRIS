import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { php } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
import { ChevronLeft, Download } from "lucide-react";
import { PeriodPicker } from "./period-picker";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function PayRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; half?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()));
  const month = parseInt(params.month ?? String(now.getMonth() + 1));
  const half = parseInt(params.half ?? (now.getDate() <= 15 ? "1" : "2"));

  const periodStart = half === 1
    ? new Date(year, month - 1, 1)
    : new Date(year, month - 1, 16);
  const periodEnd = half === 1
    ? new Date(year, month - 1, 15)
    : new Date(year, month, 0);

  const periodLabel = `${MONTHS[month - 1]} ${year} — ${half === 1 ? "1–15" : "16–end"}`;

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
    include: {
      payrolls: {
        where: { periodStart, periodEnd },
        take: 1,
      },
    },
    orderBy: [{ department: "asc" }, { lastName: "asc" }],
  });

  const rows = employees.map((e) => {
    const p = e.payrolls[0] ?? null;
    const totalDed = p
      ? p.sssEE + p.philHealthEE + p.pagIbigEE + p.withholdingTax + p.loanDeductions
      : 0;
    return { employee: e, payroll: p, totalDed };
  });

  const totals = rows.reduce(
    (acc, r) => {
      if (!r.payroll) return acc;
      return {
        basic: acc.basic + r.payroll.basicPay,
        ot: acc.ot + r.payroll.overtimePay,
        nd: acc.nd + r.payroll.nightDiffPay,
        holiday: acc.holiday + r.payroll.holidayPay,
        gross: acc.gross + r.payroll.grossPay,
        sss: acc.sss + r.payroll.sssEE,
        phic: acc.phic + r.payroll.philHealthEE,
        hdmf: acc.hdmf + r.payroll.pagIbigEE,
        wht: acc.wht + r.payroll.withholdingTax,
        loans: acc.loans + r.payroll.loanDeductions,
        ded: acc.ded + r.totalDed,
        net: acc.net + r.payroll.netPay,
      };
    },
    { basic: 0, ot: 0, nd: 0, holiday: 0, gross: 0, sss: 0, phic: 0, hdmf: 0, wht: 0, loans: 0, ded: 0, net: 0 }
  );

  const csvHref = `/api/reports/pay-register?year=${year}&month=${month}&half=${half}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Reports
        </Link>
        <a href={csvHref} download>
          <button className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] hover:bg-[var(--neutral-bg)] transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Pay Register</h1>
        <p className="text-sm text-[var(--text-secondary)]">{periodLabel}</p>
      </div>

      <PeriodPicker year={year} month={month} half={half} />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Dept</Th>
                <Th>Days</Th>
                <Th numeric>Basic</Th>
                <Th numeric>OT</Th>
                <Th numeric>ND</Th>
                <Th numeric>Holiday</Th>
                <Th numeric>Gross</Th>
                <Th numeric>SSS</Th>
                <Th numeric>PhilHealth</Th>
                <Th numeric>Pag-IBIG</Th>
                <Th numeric>WHT</Th>
                <Th numeric>Loans</Th>
                <Th numeric>Net Pay</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ employee: e, payroll: p, totalDed: _ }) => (
                <TableRow key={e.id}>
                  <Td>
                    <div className="font-medium text-xs">{e.lastName}, {e.firstName}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">{e.employeeNumber}</div>
                  </Td>
                  <Td className="text-xs">{e.department}</Td>
                  <Td numeric>{p ? p.daysWorked.toFixed(1) : "—"}</Td>
                  <Td numeric>{p ? php(p.basicPay) : "—"}</Td>
                  <Td numeric>{p ? php(p.overtimePay) : "—"}</Td>
                  <Td numeric>{p ? php(p.nightDiffPay) : "—"}</Td>
                  <Td numeric>{p ? php(p.holidayPay) : "—"}</Td>
                  <Td numeric className="font-medium">{p ? php(p.grossPay) : "—"}</Td>
                  <Td numeric className="text-[var(--text-secondary)]">{p ? php(p.sssEE) : "—"}</Td>
                  <Td numeric className="text-[var(--text-secondary)]">{p ? php(p.philHealthEE) : "—"}</Td>
                  <Td numeric className="text-[var(--text-secondary)]">{p ? php(p.pagIbigEE) : "—"}</Td>
                  <Td numeric className="text-[var(--text-secondary)]">{p ? php(p.withholdingTax) : "—"}</Td>
                  <Td numeric className="text-[var(--text-secondary)]">{p ? php(p.loanDeductions) : "—"}</Td>
                  <Td numeric className="font-semibold">{p ? php(p.netPay) : "—"}</Td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <Td colSpan={3} className="text-xs font-semibold">Totals ({rows.filter(r => r.payroll).length} employees)</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.basic)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.ot)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.nd)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.holiday)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.gross)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.sss)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.phic)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.hdmf)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.wht)}</Td>
                <Td numeric className="font-semibold text-xs">{php(totals.loans)}</Td>
                <Td numeric className="font-semibold text-xs text-[var(--brand)]">{php(totals.net)}</Td>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
