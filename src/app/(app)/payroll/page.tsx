import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, hourlyRate, computeAttendancePay, countUnpaidAbsenceDays, phDayKey } from "@/lib/ph-payroll";
import { activeCutoff, closeCutoff, ensureOpenPeriod } from "@/lib/payroll-period";
import { isFirstCutoff } from "@/lib/cutoff";
import { getPHHoliday } from "@/lib/ph-holidays";
import { PlayCircle, Wallet, FileText, Clock, ClipboardCheck, CheckCheck, Lock } from "lucide-react";
import { ExportButton } from "./ExportButton";

const OT_STATUS_BADGE: Record<string, "neutral" | "warning" | "success" | "brand"> = {
  PENDING:  "neutral",
  PREPARED: "warning",
  CHECKED:  "warning",
  APPROVED: "success",
};

async function releaseAllPayroll(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user  = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { id: true, companyId: true } });
  const start = new Date(String(formData.get("start")));
  const end   = new Date(String(formData.get("end")));
  await prisma.payroll.updateMany({
    where: { periodStart: start, periodEnd: end, status: "DRAFT" },
    data: { status: "RELEASED" },
  });
  await logAudit({ companyId: user?.companyId, userId: user?.id, action: "PAYROLL_RELEASE_ALL", target: "Payroll", meta: { start: start.toISOString(), end: end.toISOString() } });
  revalidateTag(CACHE_TAGS.PAYROLL);
  redirect(`/payroll?toast=All+payslips+released`);
}

async function closeCutoffAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true, companyId: true },
  });
  if (!user?.companyId) redirect("/dashboard");
  const start = new Date(String(formData.get("start")));
  const end   = new Date(String(formData.get("end")));
  const label = start.getDate() === 11 ? "11–25" : "26–10";

  const result = await closeCutoff(user.companyId, { start, end, label }, user.id);
  if (!result.ok) {
    redirect(`/payroll?toast=${encodeURIComponent("Release all payslips before closing this cutoff")}`);
  }
  await logAudit({
    companyId: user.companyId, userId: user.id,
    action: "PAYROLL_CUTOFF_CLOSE", target: "PayrollPeriod",
    meta: { start: start.toISOString(), end: end.toISOString() },
  });
  revalidateTag(CACHE_TAGS.PAYROLL);
  redirect(`/payroll?toast=${encodeURIComponent("Cutoff closed — advanced to next period")}`);
}

async function runPayroll(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  if (!companyId) redirect("/dashboard");
  const start = new Date(String(formData.get("start")));
  const end   = new Date(String(formData.get("end")));
  // OT pay only counted when the period's OT Approval is APPROVED
  const otApprovalRec = await prisma.oTApproval.findUnique({
    where: { companyId_periodStart_periodEnd: { companyId, periodStart: start, periodEnd: end } },
    select: { status: true },
  });
  const otApproved = otApprovalRec?.status === "APPROVED";

  const employees = await prisma.employee.findMany({ where: { companyId, archived: false } });
  const empIds = employees.map((e) => e.id);

  const GRACE_MINUTES = 5;

  // Daily rate basis: monthlyRate / 21.75 working days
  const DAYS_PER_MONTH = 21.75;

  // ── Bulk-fetch every read up front: 4 queries total instead of ~4 per employee.
  // On Turso (remote) this collapses dozens of network round-trips into a handful.
  const [allAttendance, allLeaves, existingPayrolls, activeLoans] = await Promise.all([
    prisma.attendance.findMany({ where: { employeeId: { in: empIds }, date: { gte: start, lte: end } } }),
    prisma.leaveRequest.findMany({
      where: { employeeId: { in: empIds }, status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
      select: { employeeId: true, startDate: true, endDate: true, isWithPay: true },
    }),
    prisma.payroll.findMany({
      where: { employeeId: { in: empIds }, periodStart: start, periodEnd: end },
      include: { adjustments: true },
    }),
    prisma.loan.findMany({ where: { employeeId: { in: empIds }, status: "ACTIVE" } }),
  ]);

  // Group by employeeId for O(1) per-employee lookup inside the loop.
  const attByEmp = new Map<string, typeof allAttendance>();
  for (const a of allAttendance) { const l = attByEmp.get(a.employeeId) ?? []; l.push(a); attByEmp.set(a.employeeId, l); }
  const leavesByEmp = new Map<string, typeof allLeaves>();
  for (const lv of allLeaves) { const l = leavesByEmp.get(lv.employeeId) ?? []; l.push(lv); leavesByEmp.set(lv.employeeId, l); }
  const loansByEmp = new Map<string, typeof activeLoans>();
  for (const ln of activeLoans) { const l = loansByEmp.get(ln.employeeId) ?? []; l.push(ln); loansByEmp.set(ln.employeeId, l); }
  const existingByEmp = new Map(existingPayrolls.map((p) => [p.employeeId, p]));

  // Collect upserts and commit them in a single batched transaction at the end.
  const writes: ReturnType<typeof prisma.payroll.upsert>[] = [];

  for (const e of employees) {
    // Attendance for this pay period (from the bulk fetch)
    const attendance = attByEmp.get(e.id) ?? [];
    const daysWorked = attendance.filter((a) => a.hoursWorked > 0).length;
    const regularHours = attendance.reduce((sum, a) => sum + Math.min(a.hoursWorked, 8), 0);

    // Absence deduction (fixed-salary model): only TIMEKEPT employees (≥1 record
    // this cutoff) are docked. For them, every expected workday (Mon–Fri, non-
    // holiday) with no rendered hours and no PAID leave is unpaid — covering both
    // approved unpaid leave and pure no-shows. Employees with no attendance at all
    // keep the fixed half-month (salaried fallback).
    const isTimekept = attendance.length > 0;
    const presentDays = new Set(
      attendance.filter((a) => a.hoursWorked > 0).map((a) => phDayKey(a.date)),
    );
    const approvedLeaves = leavesByEmp.get(e.id) ?? [];
    const paidLeaveDays = new Set<string>();
    for (const lv of approvedLeaves) {
      if (!lv.isWithPay) continue; // unpaid leave falls through to the absence count
      const from = lv.startDate < start ? start : lv.startDate;
      const to   = lv.endDate   > end   ? end   : lv.endDate;
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      const last = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
      while (d.getTime() <= last) { paidLeaveDays.add(phDayKey(d)); d.setDate(d.getDate() + 1); }
    }
    const absentDays = isTimekept
      ? countUnpaidAbsenceDays({ periodStart: start, periodEnd: end, presentDays, paidLeaveDays, isHoliday: (d) => getPHHoliday(d) !== null })
      : 0;
    const dailyRate = e.basicMonthlyRate / DAYS_PER_MONTH;
    const absenceDeduction = Math.round(absentDays * dailyRate * 100) / 100;

    const hr = hourlyRate(e.basicMonthlyRate);
    const attPay = computeAttendancePay(attendance, hr, otApproved);
    const overtimePayIn  = attPay.overtimePay;
    const nightDiffPayIn = attPay.nightDiffPay;
    const holidayPayIn   = attPay.holidayPay;

    // Late / undertime from attendance timeIn and hoursWorked
    let totalLateMinutes = 0;
    let totalUndertimeMinutes = 0;
    const SCHEDULE_START_MIN = 8 * 60; // 08:00

    for (const row of attendance) {
      // timeIn stored as UTC; getUTCHours/Minutes read clock time correctly regardless of server TZ.
      if (row.hoursWorked > 0) {
        let rowLate = 0;
        if (row.timeIn) {
          const t = new Date(row.timeIn);
          const tinMin = t.getUTCHours() * 60 + t.getUTCMinutes();
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

    // Preserve existing adjustments if payroll already ran for this period (bulk fetch)
    const existing = existingByEmp.get(e.id);
    const adjs = existing?.adjustments ?? [];
    const taxableAdj    = adjs.filter(a => a.type === "TAXABLE").reduce((s, a) => s + a.amount, 0);
    const nonTaxableAdj = adjs.filter(a => a.type === "NON_TAXABLE").reduce((s, a) => s + a.amount, 0);

    // SSS MSC basis: basic + OT + de minimis projected to monthly
    const sssEarningsMonthly = e.basicMonthlyRate + (overtimePayIn + nonTaxableAdj) * 2;

    const calc = computeSemiMonthlyPayroll({
      monthlyRate: e.basicMonthlyRate,
      periodStart: start,
      periodEnd: end,
      isFirstCutoff: isFirstCutoff(start),
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

    // Active loan deductions, split semi-monthly (monthly deduction / 2), capped at balance (bulk fetch)
    const loans = loansByEmp.get(e.id) ?? [];
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

    const totalDeductions = Math.round((calc.totalDeductions + loanDeductions + absenceDeduction) * 100) / 100;
    const netPay = Math.round((calc.grossPay - totalDeductions) * 100) / 100;
    const data = {
      ...calc,
      loanDeductions, totalDeductions, netPay,
      absenceDeduction, sssLoanDeduction, hdmfLoanDeduction, cashAdvanceDeduction,
    };

    // Skip employees whose payroll for this period is already RELEASED — never overwrite released records
    if (existing?.status === "RELEASED") continue;

    writes.push(
      prisma.payroll.upsert({
        where: { employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart: start, periodEnd: end } },
        update: { ...data, status: "DRAFT" },
        create: { employeeId: e.id, periodStart: start, periodEnd: end, status: "DRAFT", ...data },
      }),
    );
  }

  // One batched transaction instead of N sequential upserts.
  if (writes.length > 0) await prisma.$transaction(writes);

  const runLabel = start.getDate() === 11 ? "11–25" : "26–10";
  await ensureOpenPeriod(companyId, { start, end, label: runLabel });
  await logAudit({ companyId, userId: user?.id, action: "PAYROLL_RUN", target: "Payroll", meta: { start: start.toISOString(), end: end.toISOString(), count: employees.length } });
  revalidateTag(CACHE_TAGS.PAYROLL);
  redirect(`/payroll?toast=Payroll+computed+successfully`);
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;

  const session = await auth();
  if (!session) redirect("/login");
  const pageUser = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const pageCompanyId = pageUser?.companyId ?? "";

  // ── Reads in two parallel waves (Turso = one network round-trip per query) ──
  // Wave 1: everything that needs only companyId — run concurrently.
  const [cutoff, previewEmployees, allPeriods, periodEndRow] = await Promise.all([
    activeCutoff(pageCompanyId),
    prisma.employee.findMany({ where: { archived: false }, orderBy: { lastName: "asc" } }),
    prisma.payroll.findMany({
      select: { periodStart: true, periodEnd: true, grossPay: true, netPay: true, id: true },
      orderBy: { periodStart: "desc" },
    }),
    period
      ? prisma.payroll.findFirst({ where: { periodStart: new Date(period) }, select: { periodEnd: true } })
      : Promise.resolve(null),
  ]);

  // Resolve which period to display in the main table
  const viewStart = period ? new Date(period) : cutoff.start;
  const viewEnd = period ? (periodEndRow?.periodEnd ?? cutoff.end) : cutoff.end;
  const isCurrentCutoff = !period;

  // Wave 2: everything that needs the resolved cutoff / view window — concurrently.
  const [otApprovalRecord, previewAttendance, runs] = await Promise.all([
    pageCompanyId
      ? prisma.oTApproval.findUnique({
          where: { companyId_periodStart_periodEnd: { companyId: pageCompanyId, periodStart: cutoff.start, periodEnd: cutoff.end } },
          select: { status: true },
        })
      : Promise.resolve(null),
    prisma.attendance.findMany({ where: { date: { gte: cutoff.start, lte: cutoff.end } } }),
    prisma.payroll.findMany({
      where: { periodStart: viewStart, periodEnd: viewEnd },
      include: { employee: true },
      orderBy: { employee: { lastName: "asc" } },
    }),
  ]);
  // OT approval status for current cutoff — affects OT pay in runPayroll()
  const otStatus = otApprovalRecord?.status ?? null;
  const otApprovedForPayroll = otStatus === "APPROVED";

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
    const attPay = computeAttendancePay(rows, hr, otApprovedForPayroll);
    const estOtPay = attPay.overtimePay + attPay.nightDiffPay + attPay.holidayPay;
    const codes = [...new Set(attPay.breakdown.map((b) => b.code))];
    const otHrs = rows.reduce((s, r) => s + (r.otHours ?? 0), 0);
    return { emp, days, regHrs, otHrs, estOtPay, codes };
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

  // Deduplicate the pre-fetched periods (allPeriods, wave 1) and compute per-period totals
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

  const draftCount    = runs.filter(r => r.status === "DRAFT").length;
  const releasedCount = runs.filter(r => r.status === "RELEASED").length;

  const T = runs.reduce(
    (a, p) => ({
      gross: a.gross + p.grossPay, net: a.net + p.netPay,
      sssEE: a.sssEE + p.sssEE,   sssER: a.sssER + p.sssER,
      phicEE: a.phicEE + p.philHealthEE, phicER: a.phicER + p.philHealthER,
      hdmfEE: a.hdmfEE + p.pagIbigEE,   hdmfER: a.hdmfER + p.pagIbigER,
      wht: a.wht + p.withholdingTax,
      deminimis: a.deminimis + p.nonTaxableAdjustments,
      absences: a.absences + p.absenceDeduction,
    }),
    { gross: 0, net: 0, sssEE: 0, sssER: 0, phicEE: 0, phicER: 0, hdmfEE: 0, hdmfER: 0, wht: 0, deminimis: 0, absences: 0 }
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
                <SubmitButton>
                  <PlayCircle className="h-4 w-4" />
                  {runs.length ? "Re-run payroll" : "Run payroll"}
                </SubmitButton>
              </form>
              {runs.length > 0 && (
                <ExportButton
                  url={`/api/payroll/register?start=${cutoff.start.toISOString()}&end=${cutoff.end.toISOString()}`}
                  filename={`Payroll-Register-${cutoff.label}-${cutoff.start.getFullYear()}.xlsx`}
                />
              )}
              {draftCount > 0 && (
                <form action={releaseAllPayroll}>
                  <input type="hidden" name="start" value={cutoff.start.toISOString()} />
                  <input type="hidden" name="end"   value={cutoff.end.toISOString()} />
                  <Button variant="outline" size="sm" type="submit">
                    <CheckCheck className="h-4 w-4" />
                    Release all ({draftCount})
                  </Button>
                </form>
              )}
              <form action={closeCutoffAction}>
                <input type="hidden" name="start" value={cutoff.start.toISOString()} />
                <input type="hidden" name="end"   value={cutoff.end.toISOString()} />
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  disabled={draftCount > 0}
                  title={draftCount > 0 ? "Release all payslips before closing" : "Close this cutoff and advance to the next"}
                >
                  <Lock className="h-4 w-4" />
                  Close cutoff
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Released payroll warning */}
      {isCurrentCutoff && releasedCount > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning)]/10 px-4 py-2.5 text-sm text-[var(--warning)]">
          <ClipboardCheck className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{releasedCount} released payslip{releasedCount > 1 ? "s" : ""}</strong> in this period — re-running will skip them and only recompute DRAFT records.
          </span>
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
                <Th>Days</Th>
                <Th className="hidden sm:table-cell">Reg hrs</Th>
                <Th className="hidden sm:table-cell">OT hrs</Th>
                <Th className="hidden sm:table-cell">Rate codes</Th>
                <Th>
                  <span className="hidden sm:inline">Est. </span>OT pay
                  {!otApprovedForPayroll && (
                    <span className="hidden sm:block text-[10px] font-normal text-[var(--warning)]">not counted</span>
                  )}
                </Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map(({ emp, days, regHrs, otHrs, estOtPay, codes }) => (
                <TableRow key={emp.id}>
                  <Td>
                    <span className="text-sm font-medium whitespace-nowrap">{emp.lastName}, {emp.firstName}</span>
                  </Td>
                  <Td className="text-[var(--text-secondary)]">
                    {days > 0 ? days : <span className="text-[var(--text-tertiary)]">—</span>}
                  </Td>
                  <Td className="hidden sm:table-cell text-[var(--text-secondary)]">
                    {regHrs > 0 ? `${regHrs.toFixed(1)}h` : <span className="text-[var(--text-tertiary)]">—</span>}
                  </Td>
                  <Td className="hidden sm:table-cell text-[var(--text-secondary)]">
                    {otHrs > 0 ? `${otHrs.toFixed(1)}h` : <span className="text-[var(--text-tertiary)]">—</span>}
                  </Td>
                  <Td className="hidden sm:table-cell">
                    {codes.length > 0
                      ? <div className="flex flex-wrap gap-1">
                          {codes.map((c) => (
                            <Badge key={c} variant="neutral" className="text-[10px]">{c.replace(/_/g, " ")}</Badge>
                          ))}
                        </div>
                      : <span className="text-[var(--text-tertiary)] text-xs">—</span>
                    }
                  </Td>
                  <Td>
                    {days === 0
                      ? <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap">fixed ½mo</span>
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
                  <Th numeric className="hidden sm:table-cell">PHIC</Th>
                  <Th numeric className="hidden sm:table-cell">HDMF</Th>
                  <Th numeric className="hidden sm:table-cell">WHT</Th>
                  <Th numeric className="hidden sm:table-cell">Absences</Th>
                  <Th numeric>Net pay</Th>
                  <Th></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((p) => (
                  <TableRow key={p.id}>
                    <Td>
                      <Link href={`/employees/${p.employeeId}`} className="flex items-center gap-2 sm:gap-3 group/link">
                        <Avatar name={`${p.employee.firstName} ${p.employee.lastName}`} size="sm" />
                        <div>
                          <div className="text-sm font-medium whitespace-nowrap group-hover/link:text-[var(--brand)] transition-colors">
                            {p.employee.lastName}, {p.employee.firstName}
                          </div>
                          <div className="text-2xs text-[var(--text-tertiary)]">{p.employee.employeeNumber}</div>
                        </div>
                      </Link>
                    </Td>
                    <Td numeric>{php(p.grossPay)}</Td>
                    <Td numeric className="text-[var(--text-secondary)]">{php(p.sssEE)}</Td>
                    <Td numeric className="hidden sm:table-cell text-[var(--text-secondary)]">{php(p.philHealthEE)}</Td>
                    <Td numeric className="hidden sm:table-cell text-[var(--text-secondary)]">{php(p.pagIbigEE)}</Td>
                    <Td numeric className="hidden sm:table-cell text-[var(--text-secondary)]">{php(p.withholdingTax)}</Td>
                    <Td numeric className="hidden sm:table-cell text-[var(--error)]">
                      {p.absenceDeduction > 0 ? `−${php(p.absenceDeduction)}` : <span className="text-[var(--text-tertiary)]">—</span>}
                    </Td>
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
                  <Td numeric className="hidden sm:table-cell">{php(T.phicEE)}</Td>
                  <Td numeric className="hidden sm:table-cell">{php(T.hdmfEE)}</Td>
                  <Td numeric className="hidden sm:table-cell">{php(T.wht)}</Td>
                  <Td numeric className="hidden sm:table-cell text-[var(--error)]">
                    {T.absences > 0 ? `−${php(T.absences)}` : "—"}
                  </Td>
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
