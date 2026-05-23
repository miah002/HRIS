import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, OT_RATES, hourlyRate } from "@/lib/ph-payroll";
import { PlayCircle, Wallet, FileText, Clock } from "lucide-react";

function currentCutoff(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  if (day <= 15) return { start: new Date(year, month, 1), end: new Date(year, month, 15), label: "1–15" };
  return { start: new Date(year, month, 16), end: new Date(year, month + 1, 0), label: "16–end" };
}

async function runPayroll(formData: FormData) {
  "use server";
  const start = new Date(String(formData.get("start")));
  const end   = new Date(String(formData.get("end")));
  const employees = await prisma.employee.findMany({ where: { archived: false } });

  for (const e of employees) {
    // Fetch attendance for this pay period
    const attendance = await prisma.attendance.findMany({
      where: { employeeId: e.id, date: { gte: start, lte: end } },
    });
    const daysWorked = attendance.filter((a) => a.hoursWorked > 0).length;
    const regularHours = attendance.reduce((sum, a) => sum + Math.min(a.hoursWorked, 8), 0);

    const hr = hourlyRate(e.basicMonthlyRate);
    let overtimePayIn = 0;
    let nightDiffPayIn = 0;
    let holidayPayIn   = 0;

    const REG_PREMIUM: Record<string, number> = {
      RD: 0.30,    RD_OT: 0.30,
      SH: 0.30,    SH_OT: 0.30,  SH_RD: 0.50,   SH_RD_OT: 0.50,
      RH: 1.00,    RH_OT: 1.00,  RH_RD: 1.60,   RH_RD_OT: 1.60,
    };
    for (const row of attendance) {
      const code   = row.otRateCode;
      const regHrs = Math.min(row.hoursWorked, 8);
      const otHrs  = row.otHours ?? 0;
      const ndHrs  = row.ndHours ?? 0;
      if (!code) {
        if (otHrs > 0) overtimePayIn += Math.round(otHrs * hr * 1.25 * 100) / 100;
      } else {
        const baseCode = code.replace(/_OT$/, "");
        const regPrem  = (REG_PREMIUM[code] ?? 0) * regHrs * hr;
        const otPay    = otHrs > 0 ? otHrs * hr * (OT_RATES[code] ?? 1.25) : 0;
        const total    = Math.round((regPrem + otPay) * 100) / 100;
        if (baseCode.startsWith("RH"))      holidayPayIn   += total;
        else if (baseCode.startsWith("ND")) nightDiffPayIn += total;
        else                                overtimePayIn  += total;
      }
      if (ndHrs > 0) nightDiffPayIn += Math.round(ndHrs * hr * 0.10 * 100) / 100;
    }

    // Preserve existing adjustments if payroll already ran for this period
    const existing = await prisma.payroll.findUnique({
      where: { employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart: start, periodEnd: end } },
      include: { adjustments: true },
    });
    const taxableAdj = existing?.adjustments.filter(a => a.type === "TAXABLE").reduce((s, a) => s + a.amount, 0) ?? 0;
    const nonTaxableAdj = existing?.adjustments.filter(a => a.type === "NON_TAXABLE").reduce((s, a) => s + a.amount, 0) ?? 0;

    const calc = computeSemiMonthlyPayroll({
      monthlyRate: e.basicMonthlyRate,
      periodStart: start,
      periodEnd: end,
      daysWorked: daysWorked > 0 ? daysWorked : undefined,
      regularHours,
      overtimePayIn,
      nightDiffPayIn,
      holidayPayIn,
      taxableAdjustments: taxableAdj,
      nonTaxableAdjustments: nonTaxableAdj,
    });

    // Active loan deductions, split semi-monthly (monthly deduction / 2), capped at balance
    const loans = await prisma.loan.findMany({ where: { employeeId: e.id, status: "ACTIVE" } });
    let loanDeductions = 0;
    for (const loan of loans) {
      const semi = Math.min(loan.monthlyDeduction / 2, loan.balance);
      loanDeductions += semi;
    }
    loanDeductions = Math.round(loanDeductions * 100) / 100;

    const totalDeductions = Math.round((calc.totalDeductions + loanDeductions) * 100) / 100;
    const netPay = Math.round((calc.grossPay - totalDeductions) * 100) / 100;
    const data = { ...calc, loanDeductions, totalDeductions, netPay };

    await prisma.payroll.upsert({
      where: { employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart: start, periodEnd: end } },
      update: { ...data, status: "DRAFT" },
      create: { employeeId: e.id, periodStart: start, periodEnd: end, status: "DRAFT", ...data },
    });
  }
  redirect(`/payroll?ran=1`);
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ ran?: string }> }) {
  const { ran } = await searchParams;
  const cutoff = currentCutoff();

  // Fetch data for the hours preview card
  const previewEmployees = await prisma.employee.findMany({
    where: { archived: false },
    orderBy: { lastName: "asc" },
  });

  const previewAttendance = await prisma.attendance.findMany({
    where: { date: { gte: cutoff.start, lte: cutoff.end } },
  });

  // Group attendance rows by employeeId for the preview card
  const attByEmployee = new Map<string, typeof previewAttendance>();
  for (const row of previewAttendance) {
    const list = attByEmployee.get(row.employeeId) ?? [];
    list.push(row);
    attByEmployee.set(row.employeeId, list);
  }

  const previewRows = previewEmployees.map((emp) => {
    const rows = attByEmployee.get(emp.id) ?? [];
    const days = rows.filter((r) => r.hoursWorked > 0).length;
    const regHrs = rows.reduce((s, r) => s + Math.min(r.hoursWorked, 8), 0);
    const hr = hourlyRate(emp.basicMonthlyRate);
    let estOtPay = 0;
    const codeSet = new Set<string>();
    for (const row of rows) {
      const hours = row.otHours ?? 0;
      if (!hours) continue;
      const code = row.otRateCode ?? "R_OT";
      codeSet.add(code);
      estOtPay += Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100;
    }
    const otHrs = rows.reduce((s, r) => s + (r.otHours ?? 0), 0);
    return { emp, days, regHrs, otHrs, estOtPay, codes: [...codeSet] };
  });

  const runs = await prisma.payroll.findMany({
    where: { periodStart: cutoff.start, periodEnd: cutoff.end },
    include: { employee: true },
    orderBy: { employee: { lastName: "asc" } },
  });

  const T = runs.reduce(
    (a, p) => ({
      gross: a.gross + p.grossPay, net: a.net + p.netPay,
      sssEE: a.sssEE + p.sssEE,   sssER: a.sssER + p.sssER,
      phicEE: a.phicEE + p.philHealthEE, phicER: a.phicER + p.philHealthER,
      hdmfEE: a.hdmfEE + p.pagIbigEE,   hdmfER: a.hdmfER + p.pagIbigER,
      wht: a.wht + p.withholdingTax,
    }),
    { gross: 0, net: 0, sssEE: 0, sssER: 0, phicEE: 0, phicER: 0, hdmfEE: 0, hdmfER: 0, wht: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[var(--text-tertiary)]" />
            <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Cutoff {cutoff.label} · {phDate(cutoff.start)} – {phDate(cutoff.end)}
          </p>
        </div>
        <form action={runPayroll}>
          <input type="hidden" name="start" value={cutoff.start.toISOString()} />
          <input type="hidden" name="end"   value={cutoff.end.toISOString()} />
          <Button type="submit">
            <PlayCircle className="h-4 w-4" />
            {runs.length ? "Re-run payroll" : "Run payroll"}
          </Button>
        </form>
      </div>

      {ran && (
        <div className="rounded-[var(--radius-md)] bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] px-4 py-3 text-sm">
          ✓ Payroll computed for all active employees. Review and release below.
        </div>
      )}

      {/* Hours preview card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--brand)]" />
            Attendance summary — {cutoff.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th className="text-right">Days</Th>
                <Th className="text-right">Reg hrs</Th>
                <Th className="text-right">OT hrs</Th>
                <Th>Rate codes</Th>
                <Th className="text-right">Est. OT pay</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map(({ emp, days, regHrs, otHrs, estOtPay, codes }) => (
                <TableRow key={emp.id}>
                  <Td>
                    <span className="text-sm font-medium">{emp.lastName}, {emp.firstName}</span>
                  </Td>
                  <Td numeric className="text-[var(--text-secondary)]">
                    {days > 0 ? days : <span className="text-[var(--text-tertiary)]">—</span>}
                  </Td>
                  <Td numeric className="text-[var(--text-secondary)]">
                    {regHrs > 0 ? `${regHrs.toFixed(1)}h` : <span className="text-[var(--text-tertiary)]">—</span>}
                  </Td>
                  <Td numeric className="text-[var(--text-secondary)]">
                    {otHrs > 0 ? `${otHrs.toFixed(1)}h` : <span className="text-[var(--text-tertiary)]">—</span>}
                  </Td>
                  <Td>
                    {codes.length > 0
                      ? <div className="flex flex-wrap gap-1">
                          {codes.map((c) => (
                            <Badge key={c} variant="neutral" className="text-[10px]">{c.replace(/_/g, " ")}</Badge>
                          ))}
                        </div>
                      : <span className="text-[var(--text-tertiary)] text-xs">—</span>
                    }
                  </Td>
                  <Td numeric>
                    {days === 0
                      ? <span className="text-xs text-[var(--text-tertiary)]">fixed ½-month</span>
                      : estOtPay > 0
                        ? <span className="font-medium text-[var(--brand)]">{php(estOtPay)}</span>
                        : <span className="text-[var(--text-tertiary)]">—</span>
                    }
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Gross pay",    value: T.gross },
          { label: "Net pay",      value: T.net },
          { label: "WHT (BIR)",    value: T.wht },
          { label: "Statutory EE", value: T.sssEE + T.phicEE + T.hdmfEE },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4">
              <div className="text-2xs text-[var(--text-tertiary)] uppercase tracking-wide">{k.label}</div>
              <div className="text-lg font-semibold tabular mt-1">{php(k.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--neutral-bg)] grid place-items-center mx-auto mb-3">
              <Wallet className="h-5 w-5 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm font-medium">No payroll computed yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Click <strong>Run payroll</strong> to compute this cutoff.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <Th>Employee</Th>
                  <Th>Gross</Th>
                  <Th>SSS</Th>
                  <Th>PHIC</Th>
                  <Th>HDMF</Th>
                  <Th>WHT</Th>
                  <Th className="text-right">Net pay</Th>
                  <Th></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((p) => (
                  <TableRow key={p.id}>
                    <Td>
                      <Link href={`/employees/${p.employeeId}`} className="flex items-center gap-3 group/link">
                        <Avatar name={`${p.employee.firstName} ${p.employee.lastName}`} size="sm" />
                        <div>
                          <div className="text-sm font-medium group-hover/link:text-[var(--brand)] transition-colors">
                            {p.employee.lastName}, {p.employee.firstName}
                          </div>
                          <div className="text-2xs text-[var(--text-tertiary)]">{p.employee.employeeNumber}</div>
                        </div>
                      </Link>
                    </Td>
                    <Td numeric>{php(p.grossPay)}</Td>
                    <Td numeric className="text-[var(--text-secondary)]">{php(p.sssEE)}</Td>
                    <Td numeric className="text-[var(--text-secondary)]">{php(p.philHealthEE)}</Td>
                    <Td numeric className="text-[var(--text-secondary)]">{php(p.pagIbigEE)}</Td>
                    <Td numeric className="text-[var(--text-secondary)]">{php(p.withholdingTax)}</Td>
                    <Td numeric className="font-semibold">{php(p.netPay)}</Td>
                    <Td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_BADGE[p.status] ?? "default"}>{p.status}</Badge>
                        <Link
                          href={`/payroll/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
                        >
                          <FileText className="h-3 w-3" />Payslip
                        </Link>
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <Td className="font-medium text-xs text-[var(--text-secondary)] uppercase tracking-wide">Totals</Td>
                  <Td numeric>{php(T.gross)}</Td>
                  <Td numeric>{php(T.sssEE)}</Td>
                  <Td numeric>{php(T.phicEE)}</Td>
                  <Td numeric>{php(T.hdmfEE)}</Td>
                  <Td numeric>{php(T.wht)}</Td>
                  <Td numeric className="font-semibold">{php(T.net)}</Td>
                  <Td></Td>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Employer counterpart */}
      <Card>
        <CardHeader><CardTitle>Employer counterpart (this cutoff)</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-3 gap-3">
          {[
            { label: "SSS (employer)",        value: T.sssER },
            { label: "PhilHealth (employer)",  value: T.phicER },
            { label: "Pag-IBIG (employer)",    value: T.hdmfER },
          ].map((k) => (
            <div key={k.label} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
              <div className="text-2xs text-[var(--text-tertiary)]">{k.label}</div>
              <div className="font-semibold tabular mt-1">{php(k.value)}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-2xs text-[var(--text-tertiary)]">
        Computed using TRAIN Law (BIR RR 11-2018), SSS 2025 schedule (RA 11199), PhilHealth 5% (RA 11223), HDMF 2%/2% (Circular 460).
        See <code>src/lib/ph-payroll.ts</code>.
      </p>
    </div>
  );
}
