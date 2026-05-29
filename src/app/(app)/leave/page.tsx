import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { phDate } from "@/lib/format";
import { CalendarCheck, PlusCircle, ShieldCheck } from "lucide-react";
import { StandardLeaveForm, SpecialLeaveForm } from "./leave-form";

async function approveLeave(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");

  const req = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: { select: { id: true, employmentStatus: true } } },
  });
  if (!req) redirect("/leave?toast=Request+not+found&toastType=error");

  let isWithPay = true;

  // CONTRACTUAL always without pay
  if (req.employee.employmentStatus === "CONTRACTUAL") {
    isWithPay = false;
  } else if (["VL", "SL"].includes(req.leaveType)) {
    // Check remaining credits (VL/SL = 15 days per year)
    const yearStart = new Date(req.startDate.getFullYear(), 0, 1);
    const used = await prisma.leaveRequest.aggregate({
      where: {
        employeeId: req.employee.id,
        leaveType: req.leaveType,
        status: "APPROVED",
        isWithPay: true,
        startDate: { gte: yearStart },
        NOT: { id: req.id },
      },
      _sum: { days: true },
    });
    const usedDays = used._sum.days ?? 0;
    const remaining = Math.max(0, 15 - usedDays);
    isWithPay = remaining >= req.days;
  }
  // MATERNITY / PATERNITY always with pay (statutory)

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      isWithPay,
      approvedBy: session.user?.name ?? session.user?.email ?? "Admin",
      approvedAt: new Date(),
    },
  });
  redirect(`/leave?toast=Leave+approved+(${isWithPay ? "With+Pay" : "Without+Pay"})`);
}

async function rejectLeave(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.leaveRequest.update({ where: { id }, data: { status: "REJECTED" } });
  redirect("/leave?toast=Leave+rejected");
}

async function submitLeave(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");

  const employeeId = String(formData.get("employeeId"));
  const leaveType  = String(formData.get("leaveType"));
  const startDate  = new Date(String(formData.get("startDate")));
  const endDate    = new Date(String(formData.get("endDate")));

  // VL / SL only in standard form
  if (!["VL", "SL"].includes(leaveType)) redirect("/leave?toast=Invalid+leave+type&toastType=error");

  const days = Math.max(1, Math.ceil((+endDate - +startDate) / 86400000) + 1);
  await prisma.leaveRequest.create({ data: { employeeId, leaveType, startDate, endDate, days, status: "PENDING" } });
  redirect("/leave?toast=Leave+request+submitted");
}

async function submitSpecialLeave(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");

  const employeeId = String(formData.get("employeeId"));
  const leaveType  = String(formData.get("leaveType"));
  const startDate  = new Date(String(formData.get("startDate")));
  const endDate    = new Date(String(formData.get("endDate")));

  if (!["MATERNITY", "PATERNITY"].includes(leaveType)) redirect("/leave?toast=Invalid+special+leave+type&toastType=error");

  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { sex: true } });
  if (!emp) redirect("/leave?toast=Employee+not+found&toastType=error");

  if (leaveType === "MATERNITY" && emp.sex !== "FEMALE")
    redirect("/leave?toast=Maternity+leave+is+for+female+employees+only&toastType=error");
  if (leaveType === "PATERNITY" && emp.sex !== "MALE")
    redirect("/leave?toast=Paternity+leave+is+for+male+employees+only&toastType=error");

  const days = Math.max(1, Math.ceil((+endDate - +startDate) / 86400000) + 1);
  await prisma.leaveRequest.create({ data: { employeeId, leaveType, startDate, endDate, days, status: "PENDING" } });
  redirect("/leave?toast=Special+leave+filed");
}

export default async function LeavePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const employees = await prisma.employee.findMany({
    where: { companyId: user?.companyId ?? "", archived: false },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true, sex: true },
  });

  const requests = await prisma.leaveRequest.findMany({
    where: { employee: { companyId: user?.companyId ?? "" } },
    include: { employee: true },
    orderBy: { startDate: "desc" },
    take: 50,
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-[var(--text-tertiary)]" />
            <h1 className="text-2xl font-semibold tracking-tight">Leave management</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Bakasyon — request, approve, and track balances.</p>
        </div>
      </div>

      {/* Standard leave (VL / SL) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-[var(--brand)]" /> File a leave request
            <span className="text-xs font-normal text-[var(--text-tertiary)] ml-1">— Vacation Leave / Sick Leave</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <StandardLeaveForm employees={employees} action={submitLeave} />
        </CardContent>
      </Card>

      {/* Special leave (Maternity / Paternity — admin only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-[var(--brand)]" /> Special leave — admin
            <span className="text-xs font-normal text-[var(--text-tertiary)] ml-1">Maternity · Paternity</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Maternity leave is available only to female employees (RA 11210 — 105 days).
            Paternity leave is available only to male employees (RA 8187 — 7 days).
          </p>
          <SpecialLeaveForm employees={employees} action={submitSpecialLeave} />
        </CardContent>
      </Card>

      {/* Pending requests */}
      <Card>
        <CardHeader>
          <CardTitle>
            Pending requests
            {pending.length > 0 && (
              <Badge variant="warning" className="ml-2">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {pending.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">No pending requests. All clear!</p>
          ) : (
            <div className="space-y-2">
              {pending.map((r) => {
                const approveFn = approveLeave.bind(null, r.id);
                const rejectFn  = rejectLeave.bind(null, r.id);
                const days = Math.max(1, Math.ceil((+r.endDate - +r.startDate) / 86400000) + 1);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={`${r.employee.firstName} ${r.employee.lastName}`} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/employees/${r.employee.id}`} className="text-sm font-medium truncate hover:text-[var(--brand)] transition-colors">
                          {r.employee.firstName} {r.employee.lastName}
                        </Link>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {r.leaveType.replace(/_/g, " ")} · {phDate(r.startDate)} → {phDate(r.endDate)} ({days}d)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="warning">PENDING</Badge>
                      <form action={rejectFn}><Button size="sm" variant="secondary" type="submit">Reject</Button></form>
                      <form action={approveFn}><Button size="sm" type="submit">Approve</Button></form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Request history</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2">
            {history.map((r) => {
              const days = Math.max(1, Math.ceil((+r.endDate - +r.startDate) / 86400000) + 1);
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={`${r.employee.firstName} ${r.employee.lastName}`} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.employee.firstName} {r.employee.lastName}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {r.leaveType.replace(/_/g, " ")} · {phDate(r.startDate)} → {phDate(r.endDate)} ({days}d)
                        {r.approvedBy && <span className="ml-1">· {r.approvedBy}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {r.status === "APPROVED" && (
                      <Badge variant={r.isWithPay ? "success" : "neutral"}>
                        {r.isWithPay ? "WITH PAY" : "WITHOUT PAY"}
                      </Badge>
                    )}
                    <Badge variant={STATUS_BADGE[r.status] ?? "neutral"}>{r.status}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Leave reference */}
      <Card>
        <CardHeader><CardTitle>Leave entitlement reference</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 gap-3">
          {[
            { code: "VL", label: "Vacation Leave", days: 15, ref: "Company policy" },
            { code: "SL", label: "Sick Leave", days: 15, ref: "Company policy" },
            { code: "MATERNITY", label: "Maternity Leave (Female)", days: 105, ref: "RA 11210 — Expanded Maternity Leave" },
            { code: "PATERNITY", label: "Paternity Leave (Male)", days: 7, ref: "RA 8187 — Paternity Leave Act" },
          ].map(({ code, label, days, ref }) => (
            <div key={code} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{label}</span>
                <Badge variant="brand">{days}d</Badge>
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1 leading-relaxed">{ref}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
