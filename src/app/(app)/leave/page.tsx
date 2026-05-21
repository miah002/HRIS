import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { STATUTORY_LEAVE } from "@/lib/ph-payroll";
import { phDate } from "@/lib/format";
import { CalendarCheck, PlusCircle } from "lucide-react";

async function approveLeave(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.leaveRequest.update({ where: { id }, data: { status: "APPROVED" } });
  redirect("/leave");
}

async function rejectLeave(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.leaveRequest.update({ where: { id }, data: { status: "REJECTED" } });
  redirect("/leave");
}

async function submitLeave(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");

  const employeeId = String(formData.get("employeeId"));
  const leaveType = String(formData.get("leaveType"));
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));

  await prisma.leaveRequest.create({
    data: { employeeId, leaveType, startDate, endDate, status: "PENDING" },
  });
  redirect("/leave");
}

export default async function LeavePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const employees = await prisma.employee.findMany({
    where: { companyId: user?.companyId ?? "", archived: false },
    orderBy: { firstName: "asc" },
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

      {/* File a leave request */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-[var(--brand)]" /> File a leave request
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <form action={submitLeave} className="grid sm:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Employee</label>
              <select
                name="employeeId" required
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
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
            <div className="sm:col-span-4 flex justify-end">
              <Button type="submit" size="sm">Submit request</Button>
            </div>
          </form>
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
                const rejectFn = rejectLeave.bind(null, r.id);
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
                      <form action={rejectFn}>
                        <Button size="sm" variant="secondary" type="submit">Reject</Button>
                      </form>
                      <form action={approveFn}>
                        <Button size="sm" type="submit">Approve</Button>
                      </form>
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
                      </div>
                    </div>
                  </div>
                  <Badge variant={STATUS_BADGE[r.status] ?? "neutral"}>{r.status}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Statutory entitlements reference */}
      <Card>
        <CardHeader><CardTitle>Statutory leave entitlements</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(STATUTORY_LEAVE).map(([code, info]) => (
            <div key={code} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{code.replace(/_/g, " ")}</span>
                <Badge variant="brand">{info.days}d</Badge>
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1 leading-relaxed">{info.ref}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
