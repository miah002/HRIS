import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { php, phDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Printer } from "lucide-react";
import { PrintButton } from "./print-button";

async function releasePayroll(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.payroll.update({ where: { id }, data: { status: "RELEASED" } });
  redirect(`/payroll/${id}`);
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      employee: {
        include: { company: true },
      },
    },
  });
  if (!payroll) notFound();

  const e = payroll.employee;
  const co = e.company;
  const releaseFn = releasePayroll.bind(null, id);

  const deductions = [
    { label: "SSS contribution (EE)", ref: "RA 11199", amount: payroll.sssEE },
    { label: "PhilHealth premium (EE)", ref: "RA 11223", amount: payroll.philHealthEE },
    { label: "Pag-IBIG / HDMF (EE)", ref: "HDMF Circ. 460", amount: payroll.pagIbigEE },
    { label: "Withholding tax (BIR TRAIN)", ref: "RR 11-2018", amount: payroll.withholdingTax },
  ].filter((d) => d.amount > 0);

  if (payroll.loanDeductions > 0) {
    deductions.push({ label: "Loan amortization", ref: "Salary/company loans", amount: payroll.loanDeductions });
  }
  if (payroll.otherDeductions > 0) {
    deductions.push({ label: "Other deductions", ref: "", amount: payroll.otherDeductions });
  }

  const earnings = [
    { label: "Basic pay (½ month)", amount: payroll.basicPay },
    payroll.overtimePay > 0 && { label: "Overtime pay (×1.25)", amount: payroll.overtimePay },
    payroll.nightDiffPay > 0 && { label: "Night differential (+10%)", amount: payroll.nightDiffPay },
    payroll.holidayPay > 0 && { label: "Holiday pay", amount: payroll.holidayPay },
    payroll.allowances > 0 && { label: "Allowances", amount: payroll.allowances },
  ].filter(Boolean) as { label: string; amount: number }[];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Nav */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/payroll" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Back to payroll
        </Link>
        <div className="flex items-center gap-2">
          {payroll.status === "DRAFT" && (
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
    </div>
  );
}
