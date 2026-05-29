import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, OT_RATES, hourlyRate } from "@/lib/ph-payroll";
import { PlayCircle, Wallet, FileText, Clock, ClipboardCheck } from "lucide-react";
import { ExportButton } from "./ExportButton";

function currentCutoff(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  if (day >= 11 && day <= 25) {
    return { start: new Date(year, month, 11), end: new Date(year, month, 25), label: "11–25" };
  } else if (day >= 26) {
    return { start: new Date(year, month, 26), end: new Date(year, month + 1, 10), label: "26–10" };
  } else {
    // day 1–10: we are inside the 26–10 cutoff that started last month
    return { start: new Date(year, month - 1, 26), end: new Date(year, month, 10), label: "26–10" };
  }
}

const OT_STATUS_BADGE: Record<string, "neutral" | "warning" | "success" | "brand"> = {
  PENDING:  "neutral",
  PREPARED: "warning",
  CHECKED:  "warning",
  APPROVED: "success",
};

async function runPayroll(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  if (!companyId) redirect("/dashboard");
  const start = new Date(String(formData.get("start")));
  const end   = new Date(String(formData.get("end")));
  const isFirstCutoff = start.getDate() === 11; // 11–25 gets PHIC+HDMF; 26–10 gets SSS

  // OT pay only counted when the period's OT Approval is APPROVED
  const otApprovalRec = await prisma.oTApproval.findUnique({
    where: { companyId_periodStart_periodEnd: { companyId, periodStart: start, periodEnd: end } },
    select: { status: true },
  });
  const otApproved = otApprovalRec?.status === "APPROVED";

  const employees = await prisma.employee.findMany({ where: { companyId, archived: false } });

  const GRACE_MINUTES = 5;
  const REG_PREMIUM: Record<string, number> = {
    RD: 0.30,    RD_OT: 0.30,
    SH: 0.30,    SH_OT: 0.30,  SH_RD: 0.50,   SH_RD_OT: 0.50,
    RH: 1.00,    RH_OT: 1.00,  RH_RD: 1.60,   RH_RD_OT: 1.60,
  };

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

    // Late / undertime from attendance timeIn and hoursWorked
    let totalLateMinutes = 0;
    let totalUndertimeMinutes = 0;
    const SCHEDULE_START_MIN = 8 * 60; // 08:00

    for (const row of attendance) {
      const code   = row.otRateCode;
      const regHrs = Math.min(row.hoursWorked, 8);
      const otHrs  = otApproved ? (row.otHours ?? 0) : 0;   // zero out OT if not APPROVED
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

      // Compute late / undertime only for present days
      if (row.hoursWorked > 0) {
        let rowLate = 0;
        if (row.timeIn) {
          const t = new Date(row.timeIn);
          const tinMin = t.getHours() * 60 + t.getMinutes();
          rowLate = Math.max(0, tinMin - SCHEDULE_START_MIN - GRACE_MINUTES);
        }
        totalLateMinutes += rowLate;
        const shortageMin = Math.max(0, 480 - row.hoursWorked * 60);
        totalUndertimeMinutes += Math.max(0, shortageMin - rowLate);
      }
    }

    const perMinute = (e.basicMonthlyRate / 21.75) / 480;
    const lateDeductionIn = Math.round(totalLateMinutes * perMinute * 100) / 100;
    const undertimeDeductionIn = Math.round(totalUndertimeMinutes * perMinute * 100) / 100;

    // HDMF MP2 voluntary savings (semi-monthly: monthly / 2)
    const hdmfMp2In = Math.round(((e.hdmfMp2Monthly ?? 0) / 2) * 100) / 100;

    // Preserve existing adjustments if payroll already ran for this period
    const existing = await prisma.payroll.findUnique({
      where: { employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart: start, periodEnd: end } },
      include: { adjustments: true },
    });
    const taxableAdj = existing?.adjustments.filter(a => a.type === "TAXABLE").reduce((s, a) => s + a.amount, 0) ?? 0;
    const nonTaxableAdj = existing?.adjustments.filter(a => a.type === "NON_TAXABLE").reduce((s, a) => s + a.amount, 0) ?? 0;

    // SSS MSC basis: basic + OT + de minimis projected to monthly
    const sssEarningsMonthly = e.basicMonthlyRate + (overtimePayIn + nonTaxableAdj) * 2;

    const calc = computeSemiMonthlyPayroll({
      monthlyRate: e.basicMonthlyRate,
      periodStart: start,
      periodEnd: end,
      isFirstCutoff,
      sssEarningsMonthly,
      daysWorked: daysWorked > 0 ? daysWorked : undefined,
      regularHours,
      overtimePayIn,
      nightDiffPayIn,
      holidayPayIn,
      taxableAdjustments: taxableAdj,
      nonTaxableAdjustments: nonTaxableAdj,
      lateMinutesIn: totalLateMinutes,
      lateDeductionIn,
      undertimeMinutesIn: totalUndertimeMinutes,
      undertimeDeductionIn,
      hdmfMp2In,
    });

    // Active loan deductions, split semi-monthly (monthly deduction / 2), capped at balance
    const loans = await prisma.loan.findMany({ where: { employeeId: e.id, status: "ACTIVE" } });
    let loanDeductions = 0;
    let sssLoanDeduction = 0;
    let hdmfLoanDeduction = 0;
    let cashAdvanceDeduction = 0;
    for (const loan of loans) {
      const semi = Math.round(Math.min(loan.monthlyDeduction / 2, loan.balance) * 100) / 100;
      loanDeductions += semi;
      if (loan.type === "SSS_SALARY")   sssLoanDeduction    += semi;
      else if (loan.type === "PAGIBIG_MPL") hdmfLoanDeduction   += semi;
      else if (loan.type === "CASH_ADVANCE") cashAdvanceDeduction += semi;
    }
    loanDeductions = Math.round(loanDeductions * 100) / 100;

    // Absence deduction: semi-monthly base minus what basicPay landed at (absences already baked into basicPay)
    const expectedBasic = Math.round((e.basicMonthlyRate / 2) * 100) / 100;
    const absenceDeduction = Math.round(Math.max(0, expectedBasic - calc.basicPay) * 100) / 100;

    const totalDeductions = Math.round((calc.totalDeductions + loanDeductions) * 100) / 100;
    const netPay = Math.round((calc.grossPay - totalDeductions) * 100) / 100;
    const data = {
      ...calc,
      loanDeductions, totalDeductions, netPay,
      absenceDeduction, sssLoanDeduction, hdmfLoanDeduction, cashAdvanceDeduction,
    };

    await prisma.payroll.upsert({
      where: { employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart: start, periodEnd: end } },
      update: { ...data, status: "DRAFT" },
      create: { employeeId: e.id, periodStart: start, periodEnd: end, status: "DRAFT", ...data },
    });
  }
  redirect(`/payroll?toast=Payroll+computed+successfully`);
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const cutoff = currentCutoff();

  const session = await auth();
  if (!session) redirect("/login");
  const pageUser = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const pageCompanyId = pageUser?.companyId ?? "";

  // OT approval status for current cutoff — affects OT pay in runPayroll()
  const otApprovalRecord = pageCompanyId
    ? await prisma.oTApproval.findUnique({
        where: { companyId_periodStart_periodEnd: { companyId: pageCompanyId, periodStart: cutoff.start, periodEnd: cutoff.end } },
        select: { status: true },
      })
    : null;
  const otStatus = otApprovalRecord?.status ?? null;
  const otApprovedForPayroll = otStatus === "APPROVED";

  // Resolve which period to display in the main table
  const viewStart = period ? new Date(period) : cutoff.start;
  const viewEnd = period
    ? (await prisma.payroll.findFirst({ where: { periodStart: new Date(period) }, select: { periodEnd: true } }))?.periodEnd ?? cutoff.end
    : cutoff.end;
  const isCurrentCutoff = !period;

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

  // RD/Holiday stats for current cutoff
  const rdEmpIds = new Set<string>(); const holEmpIds = new Set<string>();
  let rdHrs = 0, holHrs = 0;
  for (const row of previewAttendance) {
    if (row.hoursWorked <= 0) continue;
    const isRD  = row.isRestDay || !!row.otRateCode?.includes("RD");
    const isHol = row.isHoliday || !!row.otRateCode?.startsWith("RH") || !!row.otRateCode?.startsWith("SH");
    if (isRD)  { rdEmpIds.add(row.employeeId);  rdHrs  += row.hoursWorked; }
    if (isHol) { holEmpIds.add(row.employeeId); holHrs += row.hoursWorked; }
  }

  // All distinct periods for the history section
  const allPeriods = await prisma.payroll.findMany({
    select: { periodStart: true, periodEnd: true, grossPay: true, netPay: true, id: true },
    orderBy: { periodStart: "desc" },
  });
  // Deduplicate periods and compute per-period totals
  const periodMap = new Map<string, { periodStart: Date; periodEnd: Date; grossPay: number; netPay: number; count: number }>();
  for (const r of allPeriods) {
    const key = r.periodStart.toISOString();
    const existing = periodMap.get(key);
    if (existing) {
      existing.grossPay += r.grossPay;
      existing.netPay += r.netPay;
      existing.count++;
    } else {
      periodMap.set(key, { periodStart: r.periodStart, periodEnd: r.periodEnd, grossPay: r.grossPay, netPay: r.netPay, count: 1 });
    }
  }
  const pastPeriods = [...periodMap.values()].filter(
    (p) => p.periodStart.toISOString() !== cutoff.start.toISOString()
  );

  const runs = await prisma.payroll.findMany({
    where: { periodStart: viewStart, periodEnd: viewEnd },
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
      deminimis: a.deminimis + p.nonTaxableAdjustments,
    }),
    { gross: 0, net: 0, sssEE: 0, sssER: 0, phicEE: 0, phicER: 0, hdmfEE: 0, hdmfER: 0, wht: 0, deminimis: 0 }
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
            {isCurrentCutoff
              ? `Current cutoff ${cutoff.label} · ${phDate(cutoff.start)} – ${phDate(cutoff.end)}`
              : `History · ${phDate(viewStart)} – ${phDate(viewEnd)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!isCurrentCutoff && (
            <Link href="/payroll">
              <Button variant="outline" size="sm">← Current cutoff</Button>
            </Link>
          )}
          {isCurrentCutoff && (
            <>
              <Link href="/ot-approval" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <ClipboardCheck className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                <Badge
                  variant={otStatus ? (OT_STATUS_BADGE[otStatus] ?? "neutral") : "neutral"}
                  dot={false}
                  className="text-xs"
                >
                  OT: {otStatus ?? "no record"}
                </Badge>
              </Link>
              <form action={runPayroll}>
                <input type="hidden" name="start" value={cutoff.start.toISOString()} />
                <input type="hidden" name="end"   value={cutoff.end.toISOString()} />
                <Button type="submit">
                  <PlayCircle className="h-4 w-4" />
                  {runs.length ? "Re-run payroll" : "Run payroll"}
                </Button>
              </form>
              {runs.length > 0 && (
                <ExportButton
                  url={`/api/payroll/register?start=${cutoff.start.toISOString()}&end=${cutoff.end.toISOString()}`}
                  filename={`Payroll-Register-${cutoff.label}-${cutoff.start.getFullYear()}.xlsx`}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Hours preview card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--brand)]" />
            Attendance summary — {cutoff.label}
          </CardTitle>
        </CardHeader>
        {!otApprovedForPayroll && (
          <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2">
            <ClipboardCheck className="h-3.5 w-3.5 text-[var(--warning)] flex-shrink-0" />
            <span className="text-xs text-[var(--warning)] font-medium">
              OT pay not counted — approval status: <strong>{otStatus ?? "no record"}</strong>.{" "}
              <Link href="/ot-approval" className="underline hover:no-underline">Approve OT</Link> to include in payroll.
            </span>
          </div>
        )}
        {(rdEmpIds.size > 0 || holEmpIds.size > 0) && (
          <div className="px-4 py-2 border-b border-[var(--border)] flex flex-wrap gap-4">
            {rdEmpIds.size > 0 && (
              <span className="text-xs text-[var(--warning)] font-medium">
                ⚠ Rest Day: {rdEmpIds.size} emp · {rdHrs.toFixed(1)}h (×1.30 premium)
              </span>
            )}
            {holEmpIds.size > 0 && (
              <span className="text-xs text-[var(--warning)] font-medium">
                ⚠ Holiday: {holEmpIds.size} emp · {holHrs.toFixed(1)}h (×2.00+ premium)
              </span>
            )}
          </div>
        )}
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th className="text-right">Days</Th>
                <Th className="text-right">Reg hrs</Th>
                <Th className="text-right">OT hrs</Th>
                <Th>Rate codes</Th>
                <Th className="text-right">
                  Est. OT pay
                  {!otApprovedForPayroll && (
                    <span className="block text-[10px] font-normal text-[var(--warning)]">not counted</span>
                  )}
                </Th>
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Gross pay",    value: T.gross },
          { label: "Net pay",      value: T.net },
          { label: "De Minimis",   value: T.deminimis },
          { label: "WHT (BIR)",   value: T.wht },
          { label: "SSS EE",      value: T.sssEE },
          { label: "PHIC EE",     value: T.phicEE },
          { label: "HDMF EE",     value: T.hdmfEE },
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
                  <Th numeric>Gross</Th>
                  <Th numeric>SSS</Th>
                  <Th numeric>PHIC</Th>
                  <Th numeric>HDMF</Th>
                  <Th numeric>WHT</Th>
                  <Th numeric>Net pay</Th>
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
      </p>

      {/* Payroll history */}
      {pastPeriods.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-[var(--brand)]" />Payroll history</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <Th>Period</Th>
                  <Th className="text-right">Employees</Th>
                  <Th className="text-right">Total gross</Th>
                  <Th className="text-right">Total net</Th>
                  <Th></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastPeriods.map((p) => {
                  const key = p.periodStart.toISOString();
                  const isSelected = period === key;
                  return (
                    <TableRow key={key} className={isSelected ? "bg-[var(--brand-bg)]" : undefined}>
                      <Td>
                        <div className="text-sm font-medium">{phDate(p.periodStart)} – {phDate(p.periodEnd)}</div>
                      </Td>
                      <Td numeric className="text-[var(--text-secondary)]">{p.count}</Td>
                      <Td numeric>{php(p.grossPay)}</Td>
                      <Td numeric className="font-semibold">{php(p.netPay)}</Td>
                      <Td>
                        <Link
                          href={isSelected ? "/payroll" : `/payroll?period=${encodeURIComponent(key)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
                        >
                          <FileText className="h-3 w-3" />{isSelected ? "Hide" : "View payslips"}
                        </Link>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
