import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { phDate } from "@/lib/format";
import { CalendarCheck, PlusCircle, ShieldCheck, BarChart2 } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { StandardLeaveForm, SpecialLeaveForm } from "./leave-form";

async function getLeaveForCompany(id: string, companyId: string) {
  return prisma.leaveRequest.findFirst({
    where: { id, employee: { companyId } },
    include: { employee: { select: { id: true, employmentStatus: true } } },
  });
}

async function approveLeave(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { id: true, companyId: true } });
  if (!user?.companyId) redirect("/dashboard");

  const req = await getLeaveForCompany(id, user.companyId);
  if (!req) redirect("/leave?toast=Request+not+found&toastType=error");

  let isWithPay = true;
  if (req.employee.employmentStatus === "CONTRACTUAL") {
    isWithPay = false;
  } else if (["VL", "SL"].includes(req.leaveType)) {
    const yearStart = new Date(req.startDate.getFullYear(), 0, 1);
    const used = await prisma.leaveRequest.aggregate({
      where: { employeeId: req.employee.id, leaveType: req.leaveType, status: "APPROVED", isWithPay: true, startDate: { gte: yearStart }, NOT: { id: req.id } },
      _sum: { days: true },
    });
    const usedDays = used._sum.days ?? 0;
    isWithPay = Math.max(0, 15 - usedDays) >= req.days;
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "APPROVED", isWithPay, approvedBy: session.user?.name ?? session.user?.email ?? "Admin", approvedAt: new Date() },
  });
  await logAudit({ companyId: user.companyId, userId: user.id, action: "LEAVE_APPROVE", target: "LeaveRequest", targetId: id, meta: { isWithPay } });
  redirect(`/leave?toast=Leave+approved+(${isWithPay ? "With+Pay" : "Without+Pay"})`);
}

async function rejectLeave(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { id: true, companyId: true } });
  if (!user?.companyId) redirect("/dashboard");
  const req = await prisma.leaveRequest.findFirst({ where: { id, employee: { companyId: user.companyId } } });
  if (!req) redirect("/leave");
  await prisma.leaveRequest.update({ where: { id }, data: { status: "REJECTED" } });
  await logAudit({ companyId: user.companyId, userId: user.id, action: "LEAVE_REJECT", target: "LeaveRequest", targetId: id });
  redirect("/leave?toast=Leave+rejected");
}

async function revokeLeave(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { id: true, companyId: true } });
  if (!user?.companyId) redirect("/dashboard");
  const req = await prisma.leaveRequest.findFirst({ where: { id, employee: { companyId: user.companyId } } });
  if (!req) redirect("/leave");
  await prisma.leaveRequest.update({ where: { id }, data: { status: "PENDING", isWithPay: true, approvedBy: null, approvedAt: null } });
  await logAudit({ companyId: user.companyId, userId: user.id, action: "LEAVE_REVOKE", target: "LeaveRequest", targetId: id });
  redirect("/leave?toast=Leave+revoked+to+pending");
}

async function togglePay(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { companyId: true } });
  if (!user?.companyId) redirect("/dashboard");
  const req = await prisma.leaveRequest.findFirst({ where: { id, employee: { companyId: user.companyId } }, select: { isWithPay: true } });
  if (!req) redirect("/leave");
  await prisma.leaveRequest.update({ where: { id }, data: { isWithPay: !req.isWithPay } });
  redirect(`/leave?toast=Changed+to+${!req.isWithPay ? "With+Pay" : "Without+Pay"}`);
}

async function updateLeave(id: string, formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { companyId: true } });
  if (!user?.companyId) redirect("/dashboard");
  const req = await prisma.leaveRequest.findFirst({ where: { id, employee: { companyId: user.companyId } } });
  if (!req) redirect("/leave");
  const startDate = new Date(String(formData.get("startDate")));
  const endDate   = new Date(String(formData.get("endDate")));
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) redirect("/leave");
  const isWithPay = formData.get("isWithPay") === "true";
  const days = Math.max(1, Math.ceil((+endDate - +startDate) / 86400000) + 1);
  await prisma.leaveRequest.update({ where: { id }, data: { startDate, endDate, days, isWithPay } });
  redirect("/leave?toast=Leave+updated");
}

async function submitLeave(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { companyId: true } });
  if (!user?.companyId) redirect("/dashboard");

  const employeeId = String(formData.get("employeeId")).trim();
  const leaveType  = String(formData.get("leaveType"));
  const startDate  = new Date(String(formData.get("startDate")));
  const endDate    = new Date(String(formData.get("endDate")));

  if (!["VL", "SL"].includes(leaveType)) redirect("/leave?toast=Invalid+leave+type&toastType=error");
  if (!employeeId || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate)
    redirect("/leave?toast=Invalid+dates&toastType=error");
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId: user.companyId } });
  if (!emp) redirect("/leave?toast=Employee+not+found&toastType=error");

  const days = Math.max(1, Math.ceil((+endDate - +startDate) / 86400000) + 1);
  await prisma.leaveRequest.create({ data: { employeeId, leaveType, startDate, endDate, days, status: "PENDING" } });
  redirect("/leave?toast=Leave+request+submitted");
}

async function submitSpecialLeave(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! }, select: { companyId: true } });
  if (!user?.companyId) redirect("/dashboard");

  const employeeId = String(formData.get("employeeId")).trim();
  const leaveType  = String(formData.get("leaveType"));
  const startDate  = new Date(String(formData.get("startDate")));
  const endDate    = new Date(String(formData.get("endDate")));

  if (!["MATERNITY", "PATERNITY"].includes(leaveType)) redirect("/leave?toast=Invalid+special+leave+type&toastType=error");
  if (!employeeId || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate)
    redirect("/leave?toast=Invalid+dates&toastType=error");

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId: user.companyId }, select: { sex: true } });
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
  const companyId = user?.companyId ?? "";

  // Leave balance: approved paid VL/SL days used this calendar year
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  // All three reads depend only on companyId — run concurrently.
  const [employees, requests, ytdLeaves] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, archived: false },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, sex: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employee: { companyId } },
      include: { employee: true },
      orderBy: { startDate: "desc" },
      take: 50,
    }),
    prisma.leaveRequest.findMany({
      where: {
        employee: { companyId },
        status: "APPROVED",
        isWithPay: true,
        leaveType: { in: ["VL", "SL"] },
        startDate: { gte: yearStart },
      },
      select: { employeeId: true, leaveType: true, days: true },
    }),
  ]);
  const ENTITLEMENT = 15;
  const balanceByEmp: Record<string, { vlUsed: number; slUsed: number }> = {};
  for (const lv of ytdLeaves) {
    if (!balanceByEmp[lv.employeeId]) balanceByEmp[lv.employeeId] = { vlUsed: 0, slUsed: 0 };
    if (lv.leaveType === "VL") balanceByEmp[lv.employeeId].vlUsed += lv.days;
    if (lv.leaveType === "SL") balanceByEmp[lv.employeeId].slUsed += lv.days;
  }

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
                      <form action={rejectFn}><SubmitButton size="sm" variant="secondary">Reject</SubmitButton></form>
                      <form action={approveFn}><SubmitButton size="sm">Approve</SubmitButton></form>
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
          <CardContent className="pt-3 space-y-0">
            {history.map((r) => {
              const days = Math.max(1, Math.ceil((+r.endDate - +r.startDate) / 86400000) + 1);
              const revokeFn     = revokeLeave.bind(null, r.id);
              const togglePayFn  = togglePay.bind(null, r.id);
              const updateFn     = updateLeave.bind(null, r.id);
              return (
                <details key={r.id} className="group border-b border-[var(--border)] last:border-0">
                  <summary className="flex items-center justify-between gap-3 py-2.5 cursor-pointer list-none">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={`${r.employee.firstName} ${r.employee.lastName}`} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.employee.firstName} {r.employee.lastName}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {r.leaveType.replace(/_/g, " ")} · {phDate(r.startDate)} → {phDate(r.endDate)} ({days}d)
                          {r.approvedBy && <span className="ml-1">· by {r.approvedBy}</span>}
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
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-1 group-open:hidden">Edit ▾</span>
                    </div>
                  </summary>

                  {/* Admin edit panel */}
                  <div className="pb-3 pl-11 space-y-3">
                    {/* Quick actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {r.status === "APPROVED" && (
                        <>
                          <form action={togglePayFn}>
                            <SubmitButton size="sm" variant="secondary">
                              Toggle → {r.isWithPay ? "Without Pay" : "With Pay"}
                            </SubmitButton>
                          </form>
                          <form action={revokeFn}>
                            <SubmitButton size="sm" variant="secondary">Revoke approval</SubmitButton>
                          </form>
                        </>
                      )}
                      {r.status === "REJECTED" && (
                        <form action={revokeFn}>
                          <SubmitButton size="sm" variant="secondary">Re-open as pending</SubmitButton>
                        </form>
                      )}
                    </div>

                    {/* Edit dates + pay */}
                    <form action={updateFn} className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Start date</label>
                        <input
                          type="date" name="startDate"
                          defaultValue={r.startDate.toISOString().slice(0, 10)}
                          className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">End date</label>
                        <input
                          type="date" name="endDate"
                          defaultValue={r.endDate.toISOString().slice(0, 10)}
                          className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Pay status</label>
                        <select name="isWithPay" defaultValue={String(r.isWithPay)}
                          className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm"
                        >
                          <option value="true">With Pay</option>
                          <option value="false">Without Pay</option>
                        </select>
                      </div>
                      <SubmitButton size="sm">Save changes</SubmitButton>
                    </form>
                  </div>
                </details>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Leave balances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[var(--brand)]" />
            Leave balances — {new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th numeric>VL used</Th>
                <Th numeric>VL remaining</Th>
                <Th numeric>SL used</Th>
                <Th numeric>SL remaining</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const b = balanceByEmp[emp.id] ?? { vlUsed: 0, slUsed: 0 };
                const vlRem = Math.max(0, ENTITLEMENT - b.vlUsed);
                const slRem = Math.max(0, ENTITLEMENT - b.slUsed);
                return (
                  <TableRow key={emp.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={`${emp.firstName} ${emp.lastName}`} size="sm" />
                        <span className="text-sm font-medium whitespace-nowrap">{emp.lastName}, {emp.firstName}</span>
                      </div>
                    </Td>
                    <Td numeric className="text-[var(--text-secondary)]">{b.vlUsed}d</Td>
                    <Td numeric>
                      <span className={vlRem <= 3 ? "text-[var(--warning)] font-medium" : ""}>{vlRem}d</span>
                    </Td>
                    <Td numeric className="text-[var(--text-secondary)]">{b.slUsed}d</Td>
                    <Td numeric>
                      <span className={slRem <= 3 ? "text-[var(--warning)] font-medium" : ""}>{slRem}d</span>
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
