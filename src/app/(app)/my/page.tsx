import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, STATUTORY_LEAVE } from "@/lib/ph-payroll";
import { Mail, Phone, Building2, CalendarCheck, Wallet } from "lucide-react";
import { Greeting } from "../dashboard/greeting";

async function requestLeave(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, include: { employee: true } });
  if (!user?.employee) redirect("/my");

  await prisma.leaveRequest.create({
    data: {
      employeeId: user.employee.id,
      leaveType: String(formData.get("leaveType")),
      startDate: new Date(String(formData.get("startDate"))),
      endDate: new Date(String(formData.get("endDate"))),
      status: "PENDING",
    },
  });
  redirect("/my");
}

export default async function MyPortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user!.email! },
    include: {
      employee: {
        include: {
          payrolls: { orderBy: { periodStart: "desc" }, take: 6 },
          leaves: { orderBy: { startDate: "desc" }, take: 10 },
        },
      },
    },
  });

  if (!user?.employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Your account is not linked to an employee record.</p>
        <p className="text-xs text-[var(--text-tertiary)]">Contact your HR administrator.</p>
      </div>
    );
  }

  const e = user.employee;
  const projected = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: new Date(), periodEnd: new Date() });
  const yearsOfService = (Date.now() - +e.dateHired) / (1000 * 60 * 60 * 24 * 365.25);
  const eligibleSIL = yearsOfService >= 1;
  const name = e.firstName;

  // Leave balances for current year
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const leaveUsedMap: Record<string, number> = {};
  for (const l of e.leaves) {
    if (l.status === "APPROVED" && l.startDate >= yearStart) {
      leaveUsedMap[l.leaveType] = (leaveUsedMap[l.leaveType] ?? 0) + l.days;
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-lg font-medium text-[var(--text-secondary)]">
          <Greeting name={name} />
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{e.position} · {e.department} · {e.employeeNumber}</p>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar name={`${e.firstName} ${e.lastName}`} size="xl" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold">{e.firstName} {e.middleName ?? ""} {e.lastName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="neutral">{e.department}</Badge>
                <Badge variant={STATUS_BADGE[e.employmentStatus]}>{e.employmentStatus}</Badge>
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-y-2 gap-x-6 text-xs text-[var(--text-secondary)]">
                {e.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{e.email}</span>}
                {e.mobile && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{e.mobile}</span>}
                <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />Hired {phDate(e.dateHired)} · {yearsOfService.toFixed(1)} years</span>
                <span className="flex items-center gap-1.5"><Wallet className="h-3 w-3" />Basic: {php(e.basicMonthlyRate)}/mo</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Latest payslip */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[var(--brand)]" /> Projected semi-monthly payslip
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-sm">
            <Row label="Basic (½ month)" value={php(projected.basicPay)} />
            <div className="border-t border-dashed border-[var(--border)] my-2" />
            <Row label="SSS (employee)" value={`−${php(projected.sssEE)}`} muted />
            <Row label="PhilHealth (EE)" value={`−${php(projected.philHealthEE)}`} muted />
            <Row label="Pag-IBIG (EE)" value={`−${php(projected.pagIbigEE)}`} muted />
            <Row label="WHT (BIR TRAIN)" value={`−${php(projected.withholdingTax)}`} muted />
            <div className="border-t border-[var(--border)] my-2" />
            <Row label="Net pay" value={php(projected.netPay)} bold />
          </CardContent>
        </Card>

        {/* File leave */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[var(--brand)]" /> File a leave request
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <form action={requestLeave} className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Leave type</label>
                <select
                  name="leaveType" required
                  className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                >
                  {Object.keys(STATUTORY_LEAVE).map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                  <option value="VL">Vacation Leave</option>
                  <option value="SL">Sick Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Start date</label>
                  <input
                    type="date" name="startDate" required
                    className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">End date</label>
                  <input
                    type="date" name="endDate" required
                    className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" className="w-full">Submit request</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Leave balances */}
      <Card>
        <CardHeader><CardTitle>My leave balances — {new Date().getFullYear()}</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(STATUTORY_LEAVE).map(([type, info]) => {
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
                  <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: entitled > 0 ? `${(remaining / entitled) * 100}%` : "0%" }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[var(--text-tertiary)]">
                  <span>{used}d used</span><span>{remaining}d left</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Leave history */}
      {e.leaves.length > 0 && (
        <Card>
          <CardHeader><CardTitle>My leave requests</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2">
            {e.leaves.map((l) => {
              const days = Math.max(1, Math.ceil((+l.endDate - +l.startDate) / 86400000) + 1);
              return (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div>
                    <div className="text-sm font-medium">{l.leaveType.replace(/_/g, " ")}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{phDate(l.startDate)} → {phDate(l.endDate)} ({days}d)</div>
                  </div>
                  <Badge variant={STATUS_BADGE[l.status] ?? "neutral"}>{l.status}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Payroll history */}
      {e.payrolls.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payroll history</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2">
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
          </CardContent>
        </Card>
      )}

      {/* Government IDs */}
      <Card>
        <CardHeader><CardTitle>Government IDs on file</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 gap-4">
          <Info label="TIN" value={e.tin ?? "—"} />
          <Info label="SSS number" value={e.sssNumber ?? "—"} />
          <Info label="PhilHealth number" value={e.philHealthNumber ?? "—"} />
          <Info label="Pag-IBIG (HDMF)" value={e.pagIbigNumber ?? "—"} />
        </CardContent>
      </Card>
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
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">{label}</div>
      <div className="text-sm font-mono mt-0.5">{value}</div>
    </div>
  );
}
