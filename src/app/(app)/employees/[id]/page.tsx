import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, STATUTORY_LEAVE } from "@/lib/ph-payroll";
import { auth } from "@/lib/auth";
import { SeparateModal } from "./SeparateModal";
import {
  ChevronLeft, Mail, Phone, Building2, Pencil, FileText,
  MapPin, PhoneCall, Briefcase, TrendingUp, DollarSign, ShieldCheck,
  Paperclip, ExternalLink, Trash2, AlertTriangle,
} from "lucide-react";

const LOAN_LABELS: Record<string, string> = {
  SSS_SALARY:  "SSS Salary Loan",
  PAGIBIG_MPL: "Pag-IBIG Multi-Purpose Loan",
  CASH_ADVANCE: "Company Cash Advance",
  OTHER:       "Other",
};

const HISTORY_BADGE: Record<string, "success" | "brand" | "warning" | "error" | "neutral"> = {
  HIRED:               "success",
  PROMOTION:           "brand",
  SALARY_CHANGE:       "warning",
  POSITION_CHANGE:     "neutral",
  DEPARTMENT_TRANSFER: "neutral",
  STATUS_CHANGE:       "neutral",
  SEPARATION:          "error",
};

const SEPARATION_TYPES = ["RESIGNED","RETIRED","END_OF_CONTRACT","TERMINATED","REDUNDANCY","RETRENCHMENT","DEATH"] as const;
const LOAN_STATUSES    = ["ACTIVE","PAID","CANCELLED"] as const;

async function getActorCompanyId(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { companyId: true } });
  return user?.companyId ?? null;
}

async function getActor(email: string): Promise<{ id: string | null; companyId: string | null }> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, companyId: true } });
  return { id: user?.id ?? null, companyId: user?.companyId ?? null };
}

async function addDocument(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const employeeId = String(formData.get("employeeId")).trim();
  const name       = String(formData.get("name")).trim();
  const url        = String(formData.get("url")).trim();
  const expiresRaw = formData.get("expiresAt") as string | null;
  if (!employeeId || !name || !url) redirect(`/employees/${employeeId}`);
  const actor = await getActor(session.user!.email!);
  if (!actor.companyId) redirect("/dashboard");
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId: actor.companyId } });
  if (!emp) redirect("/employees");
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) redirect(`/employees/${employeeId}`);
  const doc = await prisma.document.create({ data: { employeeId, name, url, expiresAt } });
  await logAudit({ companyId: actor.companyId, userId: actor.id, action: "DOCUMENT_ADD", target: "Document", targetId: doc.id, meta: { name, employeeId } });
  redirect(`/employees/${employeeId}?toast=Document+added`);
}

async function deleteDocument(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const docId      = String(formData.get("docId")).trim();
  const employeeId = String(formData.get("employeeId")).trim();
  if (!docId || !employeeId) redirect("/employees");
  const actor = await getActor(session.user!.email!);
  if (!actor.companyId) redirect("/dashboard");
  const doc = await prisma.document.findFirst({ where: { id: docId, employee: { companyId: actor.companyId } } });
  if (!doc) redirect("/employees");
  await prisma.document.delete({ where: { id: docId } });
  await logAudit({ companyId: actor.companyId, userId: actor.id, action: "DOCUMENT_DELETE", target: "Document", targetId: docId, meta: { employeeId } });
  redirect(`/employees/${employeeId}?toast=Document+removed`);
}

async function editLoan(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const loanId           = String(formData.get("loanId")).trim();
  const empId            = String(formData.get("empId")).trim();
  const balance          = Number(formData.get("balance"));
  const monthlyDeduction = Number(formData.get("monthlyDeduction"));
  const status           = String(formData.get("status"));
  if (!loanId || !empId) redirect("/employees");
  if (isNaN(balance) || balance < 0) redirect(`/employees/${empId}`);
  if (isNaN(monthlyDeduction) || monthlyDeduction < 0) redirect(`/employees/${empId}`);
  if (!(LOAN_STATUSES as readonly string[]).includes(status)) redirect(`/employees/${empId}`);
  const companyId = await getActorCompanyId(session.user!.email!);
  if (!companyId) redirect("/dashboard");
  const loan = await prisma.loan.findFirst({ where: { id: loanId, employee: { companyId } } });
  if (!loan) redirect("/employees");
  await prisma.loan.update({ where: { id: loanId }, data: { balance, monthlyDeduction, status } });
  redirect(`/employees/${empId}`);
}

async function separateEmployee(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const employeeId      = String(formData.get("employeeId")).trim();
  const separationType  = String(formData.get("separationType"));
  const separationDate  = new Date(String(formData.get("separationDate")));
  const separationNotes = (formData.get("separationNotes") as string) || null;
  if (!employeeId) redirect("/employees");
  if (!(SEPARATION_TYPES as readonly string[]).includes(separationType)) redirect(`/employees/${employeeId}`);
  if (isNaN(separationDate.getTime())) redirect(`/employees/${employeeId}`);
  const actor = await getActor(session.user!.email!);
  if (!actor.companyId) redirect("/dashboard");
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId: actor.companyId } });
  if (!emp) redirect("/employees");
  await prisma.employee.update({
    where: { id: employeeId },
    data: { archived: true, archivedAt: new Date(), separationDate, separationType, separationNotes },
  });
  await prisma.employeeHistory.create({
    data: {
      employeeId,
      type: "SEPARATION",
      effectiveDate: separationDate,
      toValue: separationType.replace(/_/g, " "),
      notes: separationNotes ?? undefined,
    },
  });
  await logAudit({ companyId: actor.companyId, userId: actor.id, action: "EMPLOYEE_SEPARATE", target: "Employee", targetId: employeeId, meta: { separationType, separationDate: separationDate.toISOString() } });
  revalidateTag(CACHE_TAGS.EMPLOYEES);
  redirect("/employees?toast=Employee+separated+and+archived");
}

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const companyId = await getActorCompanyId(session.user!.email!);
  if (!companyId) redirect("/dashboard");
  const e = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      payrolls: {
        orderBy: { periodStart: "desc" },
        select: {
          id: true, periodStart: true, periodEnd: true, status: true,
          basicPay: true, overtimePay: true, nightDiffPay: true, holidayPay: true,
          grossPay: true, netPay: true,
          sssEE: true, sssER: true, philHealthEE: true, philHealthER: true,
          pagIbigEE: true, pagIbigER: true, withholdingTax: true,
          lateDeduction: true, undertimeDeduction: true,
        },
      },
      leaves: {
        where: { startDate: { gte: new Date(new Date().getFullYear(), 0, 1) } },
        orderBy: { startDate: "desc" },
      },
      emergencyContacts: { orderBy: { isPrimary: "desc" } },
      history: { orderBy: { effectiveDate: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!e) notFound();

  const projected = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: new Date(), periodEnd: new Date() });
  const yearsOfService = (Date.now() - +e.dateHired) / (1000 * 60 * 60 * 24 * 365.25);
  // SIL removed — only VL, SL, MATERNITY, PATERNITY in use

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const usedLeaves = e.leaves.filter(l => l.status === "APPROVED" && l.startDate >= yearStart);
  const leaveUsedMap: Record<string, number> = {};
  for (const l of usedLeaves) leaveUsedMap[l.leaveType] = (leaveUsedMap[l.leaveType] ?? 0) + l.days;

  const activeLoans = await prisma.loan.findMany({ where: { employeeId: id, status: "ACTIVE" } });

  // YTD from payrolls (current calendar year)
  const ytdPayrolls = e.payrolls.filter(p => p.periodStart >= yearStart);
  const ytdGross       = ytdPayrolls.reduce((s, p) => s + p.grossPay, 0);
  const ytdNet         = ytdPayrolls.reduce((s, p) => s + p.netPay, 0);
  const ytdOTPay       = ytdPayrolls.reduce((s, p) => s + p.overtimePay, 0);
  const ytdNightDiff   = ytdPayrolls.reduce((s, p) => s + p.nightDiffPay, 0);
  const ytdSssEE       = ytdPayrolls.reduce((s, p) => s + p.sssEE, 0);
  const ytdSssER       = ytdPayrolls.reduce((s, p) => s + p.sssER, 0);
  const ytdPhicEE      = ytdPayrolls.reduce((s, p) => s + p.philHealthEE, 0);
  const ytdPhicER      = ytdPayrolls.reduce((s, p) => s + p.philHealthER, 0);
  const ytdHdmfEE      = ytdPayrolls.reduce((s, p) => s + p.pagIbigEE, 0);
  const ytdHdmfER      = ytdPayrolls.reduce((s, p) => s + p.pagIbigER, 0);
  const ytdWht         = ytdPayrolls.reduce((s, p) => s + p.withholdingTax, 0);

  const primaryEC = e.emergencyContacts[0] ?? null;
  const dateHiredISO = e.dateHired.toISOString().split("T")[0];

  return (
    <div className="space-y-6 max-w-5xl">
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
              {e.email  && <span className="flex items-center gap-1"><Mail  className="h-3 w-3" />{e.email}</span>}
              {e.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.mobile}</span>}
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{e.employeeNumber}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/employees/${e.id}/coe`}>
            <Button variant="secondary" size="sm"><FileText className="h-3.5 w-3.5" />COE</Button>
          </Link>
          <Link href={`/employees/${e.id}/2316`}>
            <Button variant="secondary" size="sm"><FileText className="h-3.5 w-3.5" />BIR 2316</Button>
          </Link>
          <Link href={`/employees/${e.id}/edit`}>
            <Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" />Edit</Button>
          </Link>
          <SeparateModal
            employeeId={e.id}
            minDate={dateHiredISO}
            separateAction={separateEmployee}
          />
        </div>
      </div>

      {/* Summary stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Years of service" value={`${yearsOfService.toFixed(1)}y`} />
        <StatCard label="Basic rate / mo" value={php(e.basicMonthlyRate)} />
        <StatCard label="Hire date" value={phDate(e.dateHired)} />
        {e.separationDate
          ? <StatCard label="Separated" value={phDate(e.separationDate)} danger />
          : <StatCard label="Status" value={e.employmentStatus} />
        }
        <StatCard label="Payroll periods" value={String(e.payrolls.length)} />
        <StatCard label="YTD gross" value={php(ytdGross)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* 201 File card */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>201 File</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-5">
            <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
              <Info label="Date hired"       value={phDate(e.dateHired)} />
              <Info label="Years of service" value={`${yearsOfService.toFixed(1)} years`} />
              <Info label="Birth date"       value={e.birthDate ? phDate(e.birthDate) : "—"} />
              <Info label="Sex"              value={e.sex ? e.sex.charAt(0) + e.sex.slice(1).toLowerCase() : "—"} />
              <Info label="Civil status"     value={e.civilStatus ? e.civilStatus.charAt(0) + e.civilStatus.slice(1).toLowerCase() : "—"} />
              <Info label="TIN"              value={e.tin ?? "—"} mono />
              <Info label="SSS number"       value={e.sssNumber ?? "—"} mono />
              <Info label="PhilHealth"       value={e.philHealthNumber ?? "—"} mono />
              <Info label="Pag-IBIG (HDMF)"  value={e.pagIbigNumber ?? "—"} mono />
            </div>

            {/* Home address */}
            {(e.addressStreet || e.addressCity) && (
              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                  <MapPin className="h-3 w-3" /> Home address
                </div>
                <p className="text-sm">
                  {[e.addressStreet, e.addressCity, e.addressProvince, e.addressZip].filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            {/* Emergency contact */}
            {primaryEC && (
              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                  <PhoneCall className="h-3 w-3" /> Emergency contact
                </div>
                <div className="text-sm font-medium">{primaryEC.name} <span className="text-[var(--text-tertiary)] font-normal">({primaryEC.relationship})</span></div>
                <div className="text-sm text-[var(--text-secondary)]">{primaryEC.phone}{primaryEC.email ? ` · ${primaryEC.email}` : ""}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave credits */}
        <Card>
          <CardHeader><CardTitle>Leave credits — {new Date().getFullYear()}</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2 text-sm">
            {(["VL", "SL"] as const).map((type) => {
              const used = leaveUsedMap[type] ?? 0;
              const rem  = Math.max(0, 15 - used);
              const pct  = Math.round((used / 15) * 100);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{type === "VL" ? "Vacation Leave" : "Sick Leave"}</span>
                    <span className={rem <= 3 ? "text-[var(--warning)] font-medium" : "text-[var(--text-secondary)]"}>
                      {used} used · <strong>{rem}</strong> remaining
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--neutral-bg)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${used >= 15 ? "bg-[var(--error)]" : used > 10 ? "bg-[var(--warning)]" : "bg-[var(--brand)]"}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Projected payslip */}
        <Card>
          <CardHeader><CardTitle>Semi-monthly payslip</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2 text-sm">
            <Row label="Basic (½ month)"  value={php(projected.basicPay)} />
            <div className="my-2 border-t border-dashed border-[var(--border)]" />
            <Row label="SSS (employee)"   value={`−${php(projected.sssEE)}`}           muted />
            <Row label="PhilHealth (EE)"  value={`−${php(projected.philHealthEE)}`}    muted />
            <Row label="Pag-IBIG (EE)"    value={`−${php(projected.pagIbigEE)}`}       muted />
            <Row label="WHT (BIR TRAIN)"  value={`−${php(projected.withholdingTax)}`}  muted />
            <div className="my-2 border-t border-[var(--border)]" />
            <Row label="Net pay" value={php(projected.netPay)} bold />
            <div className="mt-3 pt-3 border-t border-dashed border-[var(--border)]">
              <div className="text-2xs text-[var(--text-tertiary)]">Employer counterpart / cutoff</div>
              <Row label="SSS (ER)"      value={php(projected.sssER)}        muted />
              <Row label="PHIC (ER)"     value={php(projected.philHealthER)} muted />
              <Row label="Pag-IBIG (ER)" value={php(projected.pagIbigER)}    muted />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Career Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Briefcase className="h-4 w-4" />Career timeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {e.history.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No history records yet. History is tracked automatically when you edit employment details.</p>
          ) : (
            <ol className="relative border-l border-[var(--border)] ml-3 space-y-4">
              {e.history.map((h) => (
                <li key={h.id} className="pl-5 relative">
                  <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--brand)] bg-[var(--bg-elevated)]" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={HISTORY_BADGE[h.type] ?? "neutral"}>
                      {h.type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-[var(--text-tertiary)]">{phDate(h.effectiveDate)}</span>
                  </div>
                  {(h.fromValue || h.toValue) && (
                    <div className="mt-1 text-sm">
                      {h.fromValue && <span className="text-[var(--text-tertiary)]">{h.fromValue}</span>}
                      {h.fromValue && h.toValue && <span className="mx-1 text-[var(--text-tertiary)]">→</span>}
                      {h.toValue && <span className="font-medium">{h.toValue}</span>}
                    </div>
                  )}
                  {h.notes && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{h.notes}</p>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Leave balances */}
      <Card>
        <CardHeader><CardTitle>Leave balances — {new Date().getFullYear()}</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(STATUTORY_LEAVE).map(([type, info]) => {
            const isMale   = e.sex === "MALE";
            const isFemale = e.sex === "FEMALE";
            if (type === "PATERNITY" && !(isMale && e.civilStatus === "MARRIED")) return null;
            if (type === "MATERNITY" && !isFemale) return null;
            const entitled  = info.days;
            const used      = leaveUsedMap[type] ?? 0;
            const remaining = Math.max(0, entitled - used);
            return (
              <div key={type} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{type.replace(/_/g, " ")}</span>
                  <Badge variant={remaining === 0 ? "error" : remaining <= 2 ? "warning" : "success"}>
                    {remaining}/{entitled}d
                  </Badge>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--brand)] transition-all"
                    style={{ width: `${Math.max(0, (remaining / entitled) * 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[var(--text-tertiary)]">
                  <span>{used}d used</span><span>{remaining}d left</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pay History + YTD */}
      {e.payrolls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Pay history</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-4">
            {/* YTD summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="YTD Gross"     value={php(ytdGross)} />
              <StatCard label="YTD Net"       value={php(ytdNet)} />
              <StatCard label="YTD OT Pay"    value={php(ytdOTPay)} />
              <StatCard label="YTD Night Diff" value={php(ytdNightDiff)} />
            </div>

            <div className="space-y-2">
              {e.payrolls.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div>
                    <div className="text-sm">{phDate(p.periodStart)} – {phDate(p.periodEnd)}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      Basic {php(p.basicPay)} · OT {php(p.overtimePay)} · Gross {php(p.grossPay)}
                    </div>
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

      {/* Philippine Taxes YTD */}
      {ytdPayrolls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Philippine taxes & contributions — YTD {new Date().getFullYear()}</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide w-40">Type</th>
                    <th className="text-right py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">EE Share</th>
                    <th className="text-right py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">ER Share</th>
                    <th className="text-right py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <TaxRow label="SSS"       ee={ytdSssEE}  er={ytdSssER}  />
                  <TaxRow label="PhilHealth" ee={ytdPhicEE} er={ytdPhicER} />
                  <TaxRow label="Pag-IBIG"  ee={ytdHdmfEE} er={ytdHdmfER} />
                  <TaxRow label="BIR WHT"   ee={ytdWht}    er={0} showER={false} />
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--border-strong)] font-semibold">
                    <td className="py-2 text-xs">TOTAL</td>
                    <td className="py-2 text-right tabular">{php(ytdSssEE + ytdPhicEE + ytdHdmfEE + ytdWht)}</td>
                    <td className="py-2 text-right tabular">{php(ytdSssER + ytdPhicER + ytdHdmfER)}</td>
                    <td className="py-2 text-right tabular">{php(ytdSssEE + ytdSssER + ytdPhicEE + ytdPhicER + ytdHdmfEE + ytdHdmfER + ytdWht)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {e.documents.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)]">No documents attached yet.</p>
          )}
          {e.documents.map((doc) => {
            const expired = doc.expiresAt && doc.expiresAt < new Date();
            const expiringSoon = doc.expiresAt && !expired && (doc.expiresAt.getTime() - Date.now()) < 30 * 86400000;
            const delFn = deleteDocument.bind(null);
            return (
              <div key={doc.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0" />
                  <div className="min-w-0">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-[var(--brand)] flex items-center gap-1">
                      {doc.name} <ExternalLink className="h-3 w-3" />
                    </a>
                    {doc.expiresAt && (
                      <div className={`text-xs flex items-center gap-1 ${expired ? "text-[var(--error)]" : expiringSoon ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"}`}>
                        {(expired || expiringSoon) && <AlertTriangle className="h-3 w-3" />}
                        Expires {phDate(doc.expiresAt)}{expired ? " — EXPIRED" : expiringSoon ? " — expiring soon" : ""}
                      </div>
                    )}
                  </div>
                </div>
                <form action={delFn}>
                  <input type="hidden" name="docId" value={doc.id} />
                  <input type="hidden" name="employeeId" value={e.id} />
                  <SubmitButton size="sm" variant="secondary" className="text-[var(--error)]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </SubmitButton>
                </form>
              </div>
            );
          })}
          {/* Add document form */}
          <form action={addDocument} className="border-t border-dashed border-[var(--border)] pt-3 flex flex-wrap gap-2 items-end">
            <input type="hidden" name="employeeId" value={e.id} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Document name</label>
              <input type="text" name="name" placeholder="e.g. Employment Contract" required
                className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm w-48 focus:outline-none focus:border-[var(--brand)]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Link (Google Drive, etc.)</label>
              <input type="url" name="url" placeholder="https://drive.google.com/..." required
                className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm w-64 focus:outline-none focus:border-[var(--brand)]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Expiry date (optional)</label>
              <input type="date" name="expiresAt"
                className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]" />
            </div>
            <SubmitButton size="sm"><Paperclip className="h-3.5 w-3.5" />Attach</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Active loans */}
      {activeLoans.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Active loans & deductions</CardTitle></CardHeader>
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
                      className="h-8 w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]" />
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-[var(--text-tertiary)]">Monthly deduction</span>
                    <input type="number" name="monthlyDeduction" defaultValue={loan.monthlyDeduction} min="0" step="0.01"
                      className="h-8 w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]" />
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-[var(--text-tertiary)]">Status</span>
                    <select name="status" defaultValue={loan.status}
                      className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]">
                      <option value="ACTIVE">Active</option>
                      <option value="PAID">Paid</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <SubmitButton size="sm">Update loan</SubmitButton>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-sm font-semibold tabular ${danger ? "text-[var(--error)]" : ""}`}>{value}</div>
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

function TaxRow({ label, ee, er, showER = true }: { label: string; ee: number; er: number; showER?: boolean }) {
  return (
    <tr className="border-b border-[var(--border)]">
      <td className="py-2 text-[var(--text-secondary)]">{label}</td>
      <td className="py-2 text-right tabular">{php(ee)}</td>
      <td className="py-2 text-right tabular text-[var(--text-tertiary)]">{showER ? php(er) : "—"}</td>
      <td className="py-2 text-right tabular font-medium">{showER ? php(ee + er) : php(ee)}</td>
    </tr>
  );
}
