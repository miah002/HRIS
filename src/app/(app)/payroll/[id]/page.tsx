import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { php, phDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, PlayCircle } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { computeSemiMonthlyPayroll, OT_RATES, hourlyRate } from "@/lib/ph-payroll";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";

async function releasePayroll(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.payroll.update({ where: { id }, data: { status: "RELEASED" } });
  redirect(`/payroll/${id}`);
}

async function addAdjustment(id: string, formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");

  const type = String(formData.get("type")); // TAXABLE | NON_TAXABLE
  const description = String(formData.get("description")).trim();
  const amount = parseFloat(String(formData.get("amount"))) || 0;
  if (!description || amount === 0) redirect(`/payroll/${id}`);

  await prisma.payrollAdjustment.create({ data: { payrollId: id, type, description, amount } });

  // Recalculate payroll totals
  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: { employee: true, adjustments: true },
  });
  if (!payroll) redirect("/payroll");

  const taxableAdj = payroll.adjustments.filter(a => a.type === "TAXABLE").reduce((s, a) => s + a.amount, 0);
  const nonTaxableAdj = payroll.adjustments.filter(a => a.type === "NON_TAXABLE").reduce((s, a) => s + a.amount, 0);

  const isFirstCutoff = payroll.periodStart.getDate() <= 15;
  const sssEarningsMonthly = payroll.employee.basicMonthlyRate + (payroll.overtimePay + nonTaxableAdj) * 2;

  const calc = computeSemiMonthlyPayroll({
    monthlyRate: payroll.employee.basicMonthlyRate,
    periodStart: payroll.periodStart,
    periodEnd: payroll.periodEnd,
    isFirstCutoff,
    sssEarningsMonthly,
    daysWorked: payroll.daysWorked > 0 ? payroll.daysWorked : undefined,
    regularHours: payroll.regularHours,
    overtimePayIn:  payroll.overtimePay,
    holidayPayIn:   payroll.holidayPay,
    nightDiffPayIn: payroll.nightDiffPay,
    taxableAdjustments: taxableAdj,
    nonTaxableAdjustments: nonTaxableAdj,
    lateMinutesIn: payroll.lateMinutes,
    lateDeductionIn: payroll.lateDeduction,
    undertimeMinutesIn: payroll.undertimeMinutes,
    undertimeDeductionIn: payroll.undertimeDeduction,
    hdmfMp2In: payroll.hdmfMp2,
  });

  const loans = await prisma.loan.findMany({ where: { employeeId: payroll.employeeId, status: "ACTIVE" } });
  let loanDeductions = 0;
  for (const loan of loans) loanDeductions += Math.min(loan.monthlyDeduction / 2, loan.balance);
  loanDeductions = Math.round(loanDeductions * 100) / 100;

  const totalDeductions = Math.round((calc.totalDeductions + loanDeductions) * 100) / 100;
  const netPay = Math.round((calc.grossPay - totalDeductions) * 100) / 100;

  await prisma.payroll.update({ where: { id }, data: { ...calc, loanDeductions, totalDeductions, netPay } });
  redirect(`/payroll/${id}`);
}

async function removeAdjustment(adjustmentId: string, payrollId: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");

  await prisma.payrollAdjustment.delete({ where: { id: adjustmentId } });

  // Recalculate after removal
  const payroll = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: { employee: true, adjustments: true },
  });
  if (!payroll) redirect("/payroll");

  const taxableAdj = payroll.adjustments.filter(a => a.type === "TAXABLE").reduce((s, a) => s + a.amount, 0);
  const nonTaxableAdj = payroll.adjustments.filter(a => a.type === "NON_TAXABLE").reduce((s, a) => s + a.amount, 0);

  const isFirstCutoff = payroll.periodStart.getDate() <= 15;
  const sssEarningsMonthly = payroll.employee.basicMonthlyRate + (payroll.overtimePay + nonTaxableAdj) * 2;

  const calc = computeSemiMonthlyPayroll({
    monthlyRate: payroll.employee.basicMonthlyRate,
    periodStart: payroll.periodStart,
    periodEnd: payroll.periodEnd,
    isFirstCutoff,
    sssEarningsMonthly,
    daysWorked: payroll.daysWorked > 0 ? payroll.daysWorked : undefined,
    regularHours: payroll.regularHours,
    overtimePayIn:  payroll.overtimePay,
    holidayPayIn:   payroll.holidayPay,
    nightDiffPayIn: payroll.nightDiffPay,
    taxableAdjustments: taxableAdj,
    nonTaxableAdjustments: nonTaxableAdj,
    lateMinutesIn: payroll.lateMinutes,
    lateDeductionIn: payroll.lateDeduction,
    undertimeMinutesIn: payroll.undertimeMinutes,
    undertimeDeductionIn: payroll.undertimeDeduction,
    hdmfMp2In: payroll.hdmfMp2,
  });

  const loans = await prisma.loan.findMany({ where: { employeeId: payroll.employeeId, status: "ACTIVE" } });
  let loanDeductions = 0;
  for (const loan of loans) loanDeductions += Math.min(loan.monthlyDeduction / 2, loan.balance);
  loanDeductions = Math.round(loanDeductions * 100) / 100;

  const totalDeductions = Math.round((calc.totalDeductions + loanDeductions) * 100) / 100;
  const netPay = Math.round((calc.grossPay - totalDeductions) * 100) / 100;

  await prisma.payroll.update({ where: { id: payrollId }, data: { ...calc, loanDeductions, totalDeductions, netPay } });
  redirect(`/payroll/${payrollId}`);
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      employee: { include: { company: true } },
      adjustments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!payroll) notFound();

  const attendanceRows = await prisma.attendance.findMany({
    where: {
      employeeId: payroll.employeeId,
      date: { gte: payroll.periodStart, lte: payroll.periodEnd },
    },
    orderBy: { date: "asc" },
  });

  const e = payroll.employee;
  const co = e.company;

  const hr = hourlyRate(e.basicMonthlyRate);
  const attTotalRegHrs = attendanceRows.reduce((s, r) => s + Math.min(r.hoursWorked, 8), 0);
  const attTotalOtHrs  = attendanceRows.reduce((s, r) => s + (r.otHours ?? 0), 0);
  const attTotalDays   = attendanceRows.filter((r) => r.hoursWorked > 0).length;
  const attTotalOtPay  = attendanceRows.reduce((s, r) => {
    const hours = r.otHours ?? 0;
    if (!hours) return s;
    const code = r.otRateCode ?? "R_OT";
    return s + Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100;
  }, 0);

  // OT breakdown by rate code from attendance records
  const otMap = new Map<string, { hours: number; pay: number }>();
  for (const row of attendanceRows) {
    const hours = row.otHours ?? 0;
    if (!hours) continue;
    const code = row.otRateCode ?? "R_OT";
    const pay  = Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100;
    const prev = otMap.get(code);
    otMap.set(code, prev ? { hours: prev.hours + hours, pay: prev.pay + pay } : { hours, pay });
  }
  const otBreakdown = [...otMap.entries()].map(([code, { hours, pay }]) => ({
    code, hours, rate: OT_RATES[code] ?? 1.25, pay,
  }));

  const releaseFn = releasePayroll.bind(null, id);
  const addAdjustmentFn = addAdjustment.bind(null, id);

  const deductions = [
    { label: "SSS contribution (EE)", ref: "RA 11199", amount: payroll.sssEE },
    { label: "PhilHealth premium (EE)", ref: "RA 11223", amount: payroll.philHealthEE },
    { label: "Pag-IBIG / HDMF (EE)", ref: "HDMF Circ. 460 — ₱200 fixed", amount: payroll.pagIbigEE },
    { label: "Withholding tax (BIR TRAIN)", ref: "RR 11-2018", amount: payroll.withholdingTax },
  ].filter((d) => d.amount > 0);

  if (payroll.lateDeduction > 0) {
    deductions.push({ label: `Late (${Math.round(payroll.lateMinutes)}m · 5-min grace)`, ref: "DOLE Art. 113", amount: payroll.lateDeduction });
  }
  if (payroll.undertimeDeduction > 0) {
    deductions.push({ label: `Undertime (${Math.round(payroll.undertimeMinutes)}m)`, ref: "DOLE Art. 113", amount: payroll.undertimeDeduction });
  }
  if (payroll.hdmfMp2 > 0) {
    deductions.push({ label: "HDMF MP2 voluntary savings", ref: "HDMF MP2 program", amount: payroll.hdmfMp2 });
  }
  if (payroll.loanDeductions > 0) {
    deductions.push({ label: "Loan amortization", ref: "Salary/company loans", amount: payroll.loanDeductions });
  }
  if (payroll.otherDeductions > 0) {
    deductions.push({ label: "Other deductions", ref: "", amount: payroll.otherDeductions });
  }

  const earnings = [
    {
      label: payroll.daysWorked > 0
        ? `Basic pay (½ month — ${payroll.daysWorked}d worked)`
        : "Basic pay (½ month)",
      amount: payroll.basicPay,
    },
    // OT breakdown per rate code (from attendance); fall back to stored amount if no attendance detail
    ...(otBreakdown.length > 0
      ? otBreakdown.map(({ code, hours, rate, pay }) => ({
          label: `${code.replace(/_/g, " ")} — ${hours.toFixed(1)}h × ×${rate}`,
          amount: pay,
        }))
      : payroll.overtimePay > 0
        ? [{ label: "Overtime pay", amount: payroll.overtimePay }]
        : []
    ),
    payroll.nightDiffPay > 0 && { label: "Night differential (+10%)", amount: payroll.nightDiffPay },
    payroll.holidayPay > 0 && { label: "Holiday pay", amount: payroll.holidayPay },
    payroll.allowances > 0 && { label: "Allowances", amount: payroll.allowances },
    ...payroll.adjustments
      .filter(a => a.type === "TAXABLE")
      .map(a => ({ label: `${a.description} (taxable)`, amount: a.amount })),
    ...payroll.adjustments
      .filter(a => a.type === "NON_TAXABLE")
      .map(a => ({ label: `De Minimis / Non-taxable — ${a.description}`, amount: a.amount })),
  ].filter(Boolean) as { label: string; amount: number }[];

  const dbUser = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const isAdmin = (dbUser?.role ?? "OWNER") === "OWNER";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Nav */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/payroll" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Back to payroll
        </Link>
        <div className="flex items-center gap-2">
          {payroll.status === "DRAFT" && isAdmin && (
            <form action={releaseFn}>
              <Button size="sm" type="submit">Release payslip</Button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      {/* Payslip card */}
      <div id="payslip" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden print:border-0 print:shadow-none">

        {/* Header */}
        <div className="bg-[var(--brand)] px-8 py-6 text-white print:bg-[#0FA896]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium opacity-80 tracking-wide uppercase mb-1">Payslip</div>
              <h1 className="text-xl font-semibold">{co.name}</h1>
              {co.address && <p className="text-xs opacity-75 mt-0.5">{co.address}</p>}
              {co.tin && <p className="text-xs opacity-75">TIN: {co.tin}</p>}
            </div>
            <div className="text-right">
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 print:hidden">
                {payroll.status}
              </Badge>
              <p className="text-xs opacity-75 mt-2">
                Period: {phDate(payroll.periodStart)} – {phDate(payroll.periodEnd)}
              </p>
              {payroll.daysWorked > 0 && (
                <p className="text-xs opacity-75 mt-0.5">
                  Days: {payroll.daysWorked} · OT hrs: {attTotalOtHrs > 0 ? `${attTotalOtHrs.toFixed(1)}h` : "0h"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Employee info */}
        <div className="px-8 py-5 border-b border-[var(--border)] grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Employee</div>
            <div className="text-base font-semibold">{e.firstName} {e.middleName ? e.middleName + " " : ""}{e.lastName}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">{e.position} · {e.department}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{e.employeeNumber} · {e.employmentStatus}</div>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div>
              <div className="text-[var(--text-tertiary)]">Monthly rate</div>
              <div className="font-medium tabular">{php(e.basicMonthlyRate)}</div>
            </div>
            <div>
              <div className="text-[var(--text-tertiary)]">TIN</div>
              <div className="font-mono">{e.tin ?? "—"}</div>
            </div>
            <div>
              <div className="text-[var(--text-tertiary)]">SSS no.</div>
              <div className="font-mono">{e.sssNumber ?? "—"}</div>
            </div>
            <div>
              <div className="text-[var(--text-tertiary)]">PhilHealth no.</div>
              <div className="font-mono">{e.philHealthNumber ?? "—"}</div>
            </div>
            <div>
              <div className="text-[var(--text-tertiary)]">Pag-IBIG no.</div>
              <div className="font-mono">{e.pagIbigNumber ?? "—"}</div>
            </div>
            <div>
              <div className="text-[var(--text-tertiary)]">Date hired</div>
              <div>{phDate(e.dateHired)}</div>
            </div>
          </div>
        </div>

        {/* Earnings + Deductions side by side */}
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          {/* Earnings */}
          <div className="px-8 py-5">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)] mb-3 font-medium">Earnings</div>
            <div className="space-y-2.5">
              {earnings.map((row) => (
                <div key={row.label} className="flex justify-between gap-2 text-sm">
                  <span className="text-[var(--text-secondary)]">{row.label}</span>
                  <span className="tabular font-medium">{php(row.amount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-[var(--border)] flex justify-between gap-2 text-sm font-semibold">
                <span>Gross pay</span>
                <span className="tabular">{php(payroll.grossPay)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="px-8 py-5">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)] mb-3 font-medium">Deductions</div>
            <div className="space-y-2.5">
              {deductions.map((row) => (
                <div key={row.label} className="flex justify-between gap-2 text-sm">
                  <div>
                    <div className="text-[var(--text-secondary)]">{row.label}</div>
                    {row.ref && <div className="text-[10px] text-[var(--text-tertiary)]">{row.ref}</div>}
                  </div>
                  <span className="tabular text-[var(--error)]">−{php(row.amount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-[var(--border)] flex justify-between gap-2 text-sm font-semibold">
                <span>Total deductions</span>
                <span className="tabular text-[var(--error)]">−{php(payroll.totalDeductions)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net pay banner */}
        <div className="px-8 py-5 bg-[var(--bg-subtle)] border-t border-[var(--border)] flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-[var(--text-tertiary)]">Net pay for period</div>
            <div className="text-2xl font-bold tabular text-[var(--text-primary)] mt-0.5">{php(payroll.netPay)}</div>
          </div>
          <div className="text-right text-xs text-[var(--text-tertiary)]">
            <div>{phDate(payroll.periodStart)} – {phDate(payroll.periodEnd)}</div>
            <div className="mt-0.5">Status: <span className="font-medium text-[var(--text-primary)]">{payroll.status}</span></div>
          </div>
        </div>

        {/* Employer counterpart */}
        <div className="px-8 py-4 border-t border-dashed border-[var(--border)]">
          <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Employer counterpart (for remittance)</div>
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs">
            <div><span className="text-[var(--text-tertiary)]">SSS (ER): </span><span className="tabular font-medium">{php(payroll.sssER)}</span></div>
            <div><span className="text-[var(--text-tertiary)]">PhilHealth (ER): </span><span className="tabular font-medium">{php(payroll.philHealthER)}</span></div>
            <div><span className="text-[var(--text-tertiary)]">Pag-IBIG (ER): </span><span className="tabular font-medium">{php(payroll.pagIbigER)}</span></div>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-8 py-4 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
          <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
            Computed per: TRAIN Law (BIR RR 11-2018) · SSS RA 11199 (2025 schedule) · PhilHealth RA 11223 (5%) · HDMF Circ. 460 (2%/2%).
            This payslip is a system-generated document. For concerns, contact your HR administrator.
          </p>
        </div>
      </div>

      {/* Attendance detail — hidden on print */}
      <div className="print:hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border)]">
          <div className="text-sm font-semibold">Attendance records this period</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {phDate(payroll.periodStart)} – {phDate(payroll.periodEnd)}
          </div>
        </div>

        {attendanceRows.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No attendance recorded for this period.</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Basic pay computed as fixed half-month ({php(e.basicMonthlyRate / 2)}).
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Date</Th>
                <Th>Day</Th>
                <Th>Time in</Th>
                <Th>Time out</Th>
                <Th className="text-right">Reg hrs</Th>
                <Th className="text-right">OT hrs</Th>
                <Th>Rate code</Th>
                <Th className="text-right">OT pay</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceRows.map((row) => {
                const hours = row.otHours ?? 0;
                const code  = row.otRateCode ?? "R_OT";
                const rowOtPay = hours > 0
                  ? Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100
                  : 0;
                return (
                  <TableRow key={row.id}>
                    <Td className="text-[var(--text-secondary)]">
                      {row.date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </Td>
                    <Td className="text-[var(--text-secondary)]">
                      {row.date.toLocaleDateString("en-PH", { weekday: "short" })}
                    </Td>
                    <Td className="tabular text-[var(--text-secondary)]">
                      {row.timeIn ? row.timeIn.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" }) : "—"}
                    </Td>
                    <Td className="tabular text-[var(--text-secondary)]">
                      {row.timeOut ? row.timeOut.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" }) : "—"}
                    </Td>
                    <Td numeric className="text-[var(--text-secondary)]">
                      {Math.min(row.hoursWorked, 8).toFixed(1)}h
                    </Td>
                    <Td numeric className="text-[var(--text-secondary)]">
                      {hours > 0 ? `${hours.toFixed(1)}h` : "—"}
                    </Td>
                    <Td>
                      {row.otRateCode
                        ? <Badge variant="neutral" className="text-[10px]">{row.otRateCode.replace(/_/g, " ")}</Badge>
                        : <span className="text-[var(--text-tertiary)]">—</span>
                      }
                    </Td>
                    <Td numeric>
                      {rowOtPay > 0
                        ? <span className="font-medium text-[var(--brand)]">{php(rowOtPay)}</span>
                        : <span className="text-[var(--text-tertiary)]">—</span>
                      }
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <Td colSpan={4} className="text-xs font-medium text-[var(--text-secondary)]">
                  Total · {attTotalDays} day{attTotalDays !== 1 ? "s" : ""}
                </Td>
                <Td numeric className="font-semibold">{attTotalRegHrs.toFixed(1)}h</Td>
                <Td numeric className="font-semibold">{attTotalOtHrs > 0 ? `${attTotalOtHrs.toFixed(1)}h` : "—"}</Td>
                <Td />
                <Td numeric className="font-semibold text-[var(--brand)]">
                  {attTotalOtPay > 0 ? php(attTotalOtPay) : "—"}
                </Td>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      {/* Admin tools — hidden from print */}
      {isAdmin && (
        <div className="print:hidden space-y-4">

          {/* Re-run payroll */}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <div className="text-sm font-semibold mb-1">Re-run payroll</div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              To recalculate from attendance records, go to the payroll page and click "Re-run payroll".
            </p>
            <Link href="/payroll">
              <Button variant="secondary" size="sm">
                <PlayCircle className="h-3.5 w-3.5" /> Go to payroll
              </Button>
            </Link>
          </div>

          {/* Adjustments */}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <div className="text-sm font-semibold mb-1">Adjustments</div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Taxable adjustments (bonuses, commissions) increase WHT. Non-taxable (de minimis, meal/rice/clothing allowances) are excluded from tax.
            </p>

            {payroll.adjustments.length > 0 && (
              <div className="mb-4 space-y-2">
                {payroll.adjustments.map((adj) => {
                  const removeFn = removeAdjustment.bind(null, adj.id, id);
                  return (
                    <div key={adj.id} className="flex items-center justify-between gap-3 text-sm py-2 border-b border-[var(--border)] last:border-0">
                      <div>
                        <span className="font-medium">{adj.description}</span>
                        <Badge variant={adj.type === "TAXABLE" ? "warning" : "success"} className="ml-2 text-[10px]">
                          {adj.type === "TAXABLE" ? "Taxable" : "Non-taxable"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular font-medium text-[var(--brand)]">+{php(adj.amount)}</span>
                        <form action={removeFn}>
                          <button type="submit" className="text-[10px] text-[var(--error)] hover:underline">Remove</button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form action={addAdjustmentFn} className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-secondary)]">Type</label>
                <select
                  name="type"
                  className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm focus:outline-none focus:border-[var(--brand)]"
                >
                  <option value="TAXABLE">Taxable</option>
                  <option value="NON_TAXABLE">Non-taxable</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-40">
                <label className="text-xs text-[var(--text-secondary)]">Description</label>
                <input
                  type="text" name="description" required
                  placeholder="e.g. Performance bonus"
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-secondary)]">Amount (₱)</label>
                <input
                  type="number" name="amount" required min="0.01" step="0.01"
                  placeholder="0.00"
                  className="h-9 w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <Button type="submit" size="sm">Add</Button>
            </form>

            <div className="mt-3 text-[10px] text-[var(--text-tertiary)] space-y-0.5">
              <div>Non-taxable BIR limits (monthly): Meal ₱2,000 · Rice ₱2,000 · Clothing ₱500 (₱6k/yr) · Medical ₱833 (₱10k/yr) · Laundry ₱300</div>
              <div>Taxable: Bonuses exceeding ₱90k/yr, commissions, excess productivity pay.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
