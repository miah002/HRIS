import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { php, phDate } from "@/lib/format";
import { OT_RATES, hourlyRate } from "@/lib/ph-payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { ClipboardCheck, Check, Clock } from "lucide-react";

// Prepare: OWNER, MANAGER, HR  |  Check: OWNER, MANAGER, HR  |  Approve: OWNER, MANAGER
const CAN_PREPARE = ["OWNER", "MANAGER", "HR"];
const CAN_CHECK   = ["OWNER", "MANAGER", "HR"];
const CAN_APPROVE = ["OWNER", "MANAGER"];

function roleAllowed(role: string | null | undefined, allowed: string[]) {
  return allowed.includes(role ?? "");
}

function currentCutoff(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (d <= 15) return { start: new Date(y, m, 1), end: new Date(y, m, 15) };
  return { start: new Date(y, m, 16), end: new Date(y, m + 1, 0) };
}

async function prepareOT(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");
  if (!roleAllowed(user.role, CAN_PREPARE))
    redirect("/ot-approval?toast=Not+authorized+to+prepare&toastType=error");
  const start = new Date(String(formData.get("periodStart")));
  const end   = new Date(String(formData.get("periodEnd")));
  const name  = String(formData.get("preparedBy") || user.name || "Ailyn").trim();
  await prisma.oTApproval.upsert({
    where: { companyId_periodStart_periodEnd: { companyId: user.companyId, periodStart: start, periodEnd: end } },
    update: { preparedBy: name, preparedAt: new Date(), status: "PREPARED" },
    create: { companyId: user.companyId, periodStart: start, periodEnd: end, preparedBy: name, preparedAt: new Date(), status: "PREPARED" },
  });
  redirect("/ot-approval?toast=OT+marked+as+Prepared&toastType=success");
}

async function checkOT(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");
  if (!roleAllowed(user.role, CAN_CHECK))
    redirect("/ot-approval?toast=Not+authorized+to+check&toastType=error");
  const start = new Date(String(formData.get("periodStart")));
  const end   = new Date(String(formData.get("periodEnd")));
  const name  = String(formData.get("checkedBy") || user.name || "Angela").trim();
  await prisma.oTApproval.upsert({
    where: { companyId_periodStart_periodEnd: { companyId: user.companyId, periodStart: start, periodEnd: end } },
    update: { checkedBy: name, checkedAt: new Date(), status: "CHECKED" },
    create: { companyId: user.companyId, periodStart: start, periodEnd: end, checkedBy: name, checkedAt: new Date(), status: "CHECKED" },
  });
  redirect("/ot-approval?toast=OT+marked+as+Checked&toastType=success");
}

async function approveOT(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");
  if (!roleAllowed(user.role, CAN_APPROVE))
    redirect("/ot-approval?toast=Not+authorized+to+approve&toastType=error");
  const start = new Date(String(formData.get("periodStart")));
  const end   = new Date(String(formData.get("periodEnd")));
  const name  = String(formData.get("approvedBy") || user.name || "Louie").trim();
  await prisma.oTApproval.upsert({
    where: { companyId_periodStart_periodEnd: { companyId: user.companyId, periodStart: start, periodEnd: end } },
    update: { approvedBy: name, approvedAt: new Date(), status: "APPROVED" },
    create: { companyId: user.companyId, periodStart: start, periodEnd: end, approvedBy: name, approvedAt: new Date(), status: "APPROVED" },
  });
  redirect("/ot-approval?toast=OT+Approved&toastType=success");
}

const STATUS_COLORS: Record<string, "neutral" | "warning" | "brand" | "success"> = {
  PENDING:  "neutral",
  PREPARED: "warning",
  CHECKED:  "brand",
  APPROVED: "success",
};

export default async function OTApprovalPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");

  const cutoff = currentCutoff();

  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: cutoff.start, lte: cutoff.end }, employee: { companyId: user.companyId } },
    include: { employee: true },
    orderBy: { date: "asc" },
  });

  const approval = await prisma.oTApproval.findUnique({
    where: { companyId_periodStart_periodEnd: { companyId: user.companyId, periodStart: cutoff.start, periodEnd: cutoff.end } },
  });

  // Build per-employee OT summary
  type EmpRow = { name: string; employeeId: string; otHours: number; otPay: number; codes: Set<string> };
  const empMap = new Map<string, EmpRow>();
  for (const row of attendance) {
    const hours = row.otHours ?? 0;
    if (hours <= 0) continue;
    const hr  = hourlyRate(row.employee.basicMonthlyRate);
    const code = row.otRateCode ?? "R_OT";
    const pay  = Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100;
    const prev = empMap.get(row.employeeId);
    if (prev) {
      prev.otHours += hours;
      prev.otPay   += pay;
      prev.codes.add(code);
    } else {
      empMap.set(row.employeeId, {
        name: `${row.employee.lastName}, ${row.employee.firstName}`,
        employeeId: row.employeeId,
        otHours: hours,
        otPay: pay,
        codes: new Set([code]),
      });
    }
  }
  const otRows = [...empMap.values()].sort((a, b) => b.otHours - a.otHours);
  const totalOtHours = otRows.reduce((s, r) => s + r.otHours, 0);
  const totalOtPay   = otRows.reduce((s, r) => s + r.otPay, 0);

  const status = approval?.status ?? "PENDING";
  const isPrepared = ["PREPARED", "CHECKED", "APPROVED"].includes(status);
  const isChecked  = ["CHECKED", "APPROVED"].includes(status);
  const isApproved = status === "APPROVED";

  const canPrepare = roleAllowed(user.role, CAN_PREPARE);
  const canCheck   = roleAllowed(user.role, CAN_CHECK);
  const canApprove = roleAllowed(user.role, CAN_APPROVE);

  const cutoffLabel = `${phDate(cutoff.start)} – ${phDate(cutoff.end)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[var(--text-tertiary)]" />
            <h1 className="text-2xl font-semibold tracking-tight">OT Approval</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {cutoffLabel} · {otRows.length} employee{otRows.length !== 1 ? "s" : ""} with OT
          </p>
        </div>
        <Badge variant={STATUS_COLORS[status] ?? "neutral"} className="text-sm px-3 py-1">
          {status}
        </Badge>
      </div>

      {/* OT summary table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-[var(--brand)]" />
            Overtime detail — {cutoffLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {otRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-tertiary)]">No overtime recorded this cutoff.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <Th>Employee</Th>
                  <Th className="text-right">OT Hours</Th>
                  <Th>Rate codes</Th>
                  <Th className="text-right">OT Pay</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otRows.map((r) => (
                  <TableRow key={r.employeeId}>
                    <Td className="font-medium">{r.name}</Td>
                    <Td numeric>{r.otHours.toFixed(1)}h</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {[...r.codes].map((c) => (
                          <Badge key={c} variant="neutral" className="text-[10px]">{c.replace(/_/g, " ")}</Badge>
                        ))}
                      </div>
                    </Td>
                    <Td numeric className="font-medium text-[var(--brand)]">{php(r.otPay)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {otRows.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between text-sm font-semibold">
              <span>{otRows.length} employees · {totalOtHours.toFixed(1)} total hours</span>
              <span className="text-[var(--brand)]">{php(totalOtPay)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval stages */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Stage 1: Prepared */}
        <Card className={isPrepared ? "border-[var(--success)]" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {isPrepared
                ? <Check className="h-4 w-4 text-[var(--success)]" />
                : <span className="h-5 w-5 rounded-full border-2 border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-tertiary)]">1</span>
              }
              Prepared by
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isPrepared ? (
              <div>
                <div className="text-sm font-semibold">{approval?.preparedBy}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {approval?.preparedAt ? phDate(approval.preparedAt) : "—"}
                </div>
              </div>
            ) : canPrepare ? (
              <form action={prepareOT} className="space-y-3">
                <input type="hidden" name="periodStart" value={cutoff.start.toISOString()} />
                <input type="hidden" name="periodEnd"   value={cutoff.end.toISOString()} />
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1">Preparer name</label>
                  <input
                    name="preparedBy" defaultValue={user.name ?? "Ailyn"}
                    className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm focus:outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={otRows.length === 0}>
                  Mark as Prepared
                </Button>
              </form>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Requires Owner, Manager, or HR role.</p>
            )}
          </CardContent>
        </Card>

        {/* Stage 2: Checked */}
        <Card className={isChecked ? "border-[var(--success)]" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {isChecked
                ? <Check className="h-4 w-4 text-[var(--success)]" />
                : <span className="h-5 w-5 rounded-full border-2 border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-tertiary)]">2</span>
              }
              Checked by
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isChecked ? (
              <div>
                <div className="text-sm font-semibold">{approval?.checkedBy}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {approval?.checkedAt ? phDate(approval.checkedAt) : "—"}
                </div>
              </div>
            ) : canCheck ? (
              <form action={checkOT} className="space-y-3">
                <input type="hidden" name="periodStart" value={cutoff.start.toISOString()} />
                <input type="hidden" name="periodEnd"   value={cutoff.end.toISOString()} />
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1">Checker name</label>
                  <input
                    name="checkedBy" defaultValue={user.name ?? "Angela"}
                    className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm focus:outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <Button
                  type="submit" size="sm" className="w-full"
                  disabled={!isPrepared}
                >
                  Mark as Checked
                </Button>
                {!isPrepared && (
                  <p className="text-[10px] text-[var(--text-tertiary)] text-center">Requires Prepare first</p>
                )}
              </form>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Requires Owner, Manager, or HR role.</p>
            )}
          </CardContent>
        </Card>

        {/* Stage 3: Approved */}
        <Card className={isApproved ? "border-[var(--success)]" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {isApproved
                ? <Check className="h-4 w-4 text-[var(--success)]" />
                : <span className="h-5 w-5 rounded-full border-2 border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-tertiary)]">3</span>
              }
              Approved by
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isApproved ? (
              <div>
                <div className="text-sm font-semibold">{approval?.approvedBy}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {approval?.approvedAt ? phDate(approval.approvedAt) : "—"}
                </div>
              </div>
            ) : canApprove ? (
              <form action={approveOT} className="space-y-3">
                <input type="hidden" name="periodStart" value={cutoff.start.toISOString()} />
                <input type="hidden" name="periodEnd"   value={cutoff.end.toISOString()} />
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1">Approver name</label>
                  <input
                    name="approvedBy" defaultValue={user.name ?? "Louie"}
                    className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm focus:outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <Button
                  type="submit" size="sm" className="w-full"
                  disabled={!isChecked}
                >
                  Approve OT
                </Button>
                {!isChecked && (
                  <p className="text-[10px] text-[var(--text-tertiary)] text-center">Requires Check first</p>
                )}
              </form>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Requires Owner or Manager role.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval summary when approved */}
      {isApproved && (
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-4">Approval record</div>
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <div className="text-xs text-[var(--text-tertiary)] mb-0.5">Prepared by</div>
                <div className="font-semibold">{approval?.preparedBy}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{approval?.preparedAt ? phDate(approval.preparedAt) : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] mb-0.5">Checked by</div>
                <div className="font-semibold">{approval?.checkedBy}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{approval?.checkedAt ? phDate(approval.checkedAt) : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] mb-0.5">Approved by</div>
                <div className="font-semibold">{approval?.approvedBy}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{approval?.approvedAt ? phDate(approval.approvedAt) : "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-2xs text-[var(--text-tertiary)]">
        OT pay computed per Labor Code Art. 87–93. Approval must be completed before running payroll for this cutoff.
      </p>
    </div>
  );
}
