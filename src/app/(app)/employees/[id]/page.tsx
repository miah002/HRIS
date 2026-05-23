import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, STATUTORY_LEAVE } from "@/lib/ph-payroll";
import { auth } from "@/lib/auth";
import { ChevronLeft, Mail, Phone, Building2, Pencil, FileText } from "lucide-react";

const LOAN_LABELS: Record<string, string> = {
  SSS_SALARY: "SSS Salary Loan",
  PAGIBIG_MPL: "Pag-IBIG Multi-Purpose Loan",
  CASH_ADVANCE: "Company Cash Advance",
  OTHER: "Other",
};

async function editLoan(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const loanId        = String(formData.get("loanId"));
  const empId         = String(formData.get("empId"));
  const balance       = Number(formData.get("balance"));
  const monthlyDeduction = Number(formData.get("monthlyDeduction"));
  const status        = String(formData.get("status"));
  await prisma.loan.update({
    where: { id: loanId },
    data: { balance, monthlyDeduction, status },
  });
  redirect(`/employees/${empId}`);
}

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.employee.findUnique({
    where: { id },
    include: {
      payrolls: { orderBy: { periodStart: "desc" }, take: 6 },
      leaves: { orderBy: { startDate: "desc" }, take: 5 },
    },
  });
  if (!e) notFound();

  async function archive() {
    "use server";
    await prisma.employee.update({ where: { id }, data: { archived: true, archivedAt: new Date() } });
    redirect("/employees");
  }

  const projected = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: new Date(), periodEnd: new Date() });
  const yearsOfService = (Date.now() - +e.dateHired) / (1000 * 60 * 60 * 24 * 365.25);
  const eligibleSIL = yearsOfService >= 1;

  // Leave balances: compute used days per type this year
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const usedLeaves = e.leaves.filter(l => l.status === "APPROVED" && l.startDate >= yearStart);
  const leaveUsedMap: Record<string, number> = {};
  for (const l of usedLeaves) leaveUsedMap[l.leaveType] = (leaveUsedMap[l.leaveType] ?? 0) + l.days;

  // Active loans
  const activeLoans = await prisma.loan.findMany({
    where: { employeeId: id, status: "ACTIVE" },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back link */}
      <Link href="/employees" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
        <ChevronLeft className="h-3 w-3" /> Back to employees
      </Link>

      {/* Profile header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${e.firstName} ${e.lastName}`} size="xl" />
          <div>
            <h1 className="text-xl font-semibold">{e.firstName} {e.middleName ?? ""} {e.lastName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-[var(--text-secondary)]">{e.position}</span>
              <span className="text-[var(--border-strong)]">·</span>
              <Badge variant="neutral">{e.department}</Badge>
              <Badge variant={STATUS_BADGE[e.employmentStatus]}>{e.employmentStatus}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
              {e.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{e.email}</span>}
              {e.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.mobile}</span>}
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{e.employeeNumber}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/employees/${e.id}/coe`}>
            <Button variant="secondary" size="sm"><FileText className="h-3.5 w-3.5" />COE</Button>
          </Link>
          <Link href={`/employees/${e.id}/edit`}>
            <Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" />Edit</Button>
          </Link>
          <form action={archive}>
            <Button type="submit" variant="danger" size="sm">Archive</Button>
          </form>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* 201 Info */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>201 File</CardTitle></CardHeader>
          <CardContent className="pt-3 grid sm:grid-cols-2 gap-y-4 gap-x-8">
            <Info label="Date hired" value={phDate(e.dateHired)} />
            <Info label="Years of service" value={`${yearsOfService.toFixed(1)} years`} />
            <Info label="Basic monthly rate" value={php(e.basicMonthlyRate)} />
            <Info label="Sex" value={e.sex ? e.sex.charAt(0) + e.sex.slice(1).toLowerCase() : "—"} />
            <Info label="Civil status" value={e.civilStatus ? e.civilStatus.charAt(0) + e.civilStatus.slice(1).toLowerCase() : "—"} />
            <Info label="TIN" value={e.tin ?? "—"} mono />
            <Info label="SSS number" value={e.sssNumber ?? "—"} mono />
            <Info label="PhilHealth number" value={e.philHealthNumber ?? "—"} mono />
            <Info label="Pag-IBIG (HDMF)" value={e.pagIbigNumber ?? "—"} mono />
          </CardContent>
        </Card>

        {/* Projected payslip */}
        <Card>
          <CardHeader><CardTitle>Semi-monthly payslip</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2 text-sm">
            <Row label="Basic (½ month)"    value={php(projected.basicPay)} />
            <div className="my-2 border-t border-dashed border-[var(--border)]" />
            <Row label="SSS (employee)"    value={`−${php(projected.sssEE)}`} muted />
            <Row label="PhilHealth (EE)"   value={`−${php(projected.philHealthEE)}`} muted />
            <Row label="Pag-IBIG (EE)"     value={`−${php(projected.pagIbigEE)}`} muted />
            <Row label="WHT (BIR TRAIN)"   value={`−${php(projected.withholdingTax)}`} muted />
            <div className="my-2 border-t border-[var(--border)]" />
            <Row label="Net pay" value={php(projected.netPay)} bold />
            <div className="mt-3 pt-3 border-t border-dashed border-[var(--border)]">
              <div className="text-2xs text-[var(--text-tertiary)]">Employer counterpart / cutoff</div>
              <Row label="SSS (ER)"     value={php(projected.sssER)} muted />
              <Row label="PHIC (ER)"    value={php(projected.philHealthER)} muted />
              <Row label="Pag-IBIG (ER)" value={php(projected.pagIbigER)} muted />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave balances */}
      <Card>
        <CardHeader><CardTitle>Leave balances — {new Date().getFullYear()}</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(STATUTORY_LEAVE).map(([type, info]) => {
            const isMale   = e.sex === "MALE";
            const isFemale = e.sex === "FEMALE";
            // Paternity: MALE + MARRIED only; Maternity/Magna Carta/VAWC: FEMALE only
            if (type === "PATERNITY" && !(isMale && e.civilStatus === "MARRIED")) return null;
            if (type === "MATERNITY" && !isFemale) return null;
            const ineligible = type === "SIL" && !eligibleSIL;
            const entitled = ineligible ? 0 : info.days;
            const used = leaveUsedMap[type] ?? 0;
            const remaining = Math.max(0, entitled - used);
            return (
              <div key={type} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{type.replace(/_/g, " ")}</span>
                  <Badge variant={ineligible ? "neutral" : remaining === 0 ? "error" : remaining <= 2 ? "warning" : "success"}>
                    {remaining}/{entitled}d
                  </Badge>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand)] transition-all"
                    style={{ width: entitled > 0 ? `${Math.max(0, (remaining / entitled) * 100)}%` : "0%" }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[var(--text-tertiary)]">
                  <span>{used}d used</span>
                  <span>{remaining}d left</span>
                </div>
                {ineligible && <p className="text-[10px] text-[var(--warning)] mt-1">Requires 1 year of service</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Active loans */}
      {activeLoans.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Active loans & deductions</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-3">
            {activeLoans.map((loan) => (
              <div key={loan.id} className="border border-[var(--border)] rounded-[var(--radius-sm)] p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{LOAN_LABELS[loan.type] ?? loan.type}</div>
                    {loan.description && <div className="text-xs text-[var(--text-tertiary)]">{loan.description}</div>}
                  </div>
                  <div className="text-right text-sm">
                    <div className="tabular">Balance: <span className="font-semibold">{php(loan.balance)}</span></div>
                    <div className="text-xs text-[var(--text-tertiary)]">{php(loan.monthlyDeduction)}/mo deduction</div>
                  </div>
                </div>
                <form action={editLoan} className="flex flex-wrap gap-2 items-end border-t border-dashed border-[var(--border)] pt-2">
                  <input type="hidden" name="loanId" value={loan.id} />
                  <input type="hidden" name="empId"  value={e.id} />
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-[var(--text-tertiary)]">Balance</span>
                    <input type="number" name="balance" defaultValue={loan.balance} min="0" step="0.01"
                      className="h-8 w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-[var(--text-tertiary)]">Monthly deduction</span>
                    <input type="number" name="monthlyDeduction" defaultValue={loan.monthlyDeduction} min="0" step="0.01"
                      className="h-8 w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-[var(--text-tertiary)]">Status</span>
                    <select name="status" defaultValue={loan.status}
                      className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="PAID">Paid</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <Button type="submit" size="sm">Update loan</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent payroll */}
      {e.payrolls.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent payroll history</CardTitle></CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2">
              {e.payrolls.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div>
                    <div className="text-sm">{phDate(p.periodStart)} – {phDate(p.periodEnd)}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Gross {php(p.grossPay)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular">{php(p.netPay)}</div>
                    <Badge variant={p.status === "RELEASED" ? "success" : "neutral"}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-2xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}>
      <span className={muted ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
