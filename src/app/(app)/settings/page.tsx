import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { Settings, ShieldAlert, ClipboardCheck, CalendarDays, Activity } from "lucide-react";
import Link from "next/link";

const ROLES = ["OWNER", "MANAGER", "HR", "EMPLOYEE"] as const;
type Role = typeof ROLES[number];

const ROLE_META: Record<Role, { label: string; variant: "brand" | "success" | "warning" | "neutral" }> = {
  OWNER:    { label: "Owner",    variant: "brand" },
  MANAGER:  { label: "Manager",  variant: "success" },
  HR:       { label: "HR",       variant: "warning" },
  EMPLOYEE: { label: "Employee", variant: "neutral" },
};

const ROLE_PERMS: Record<Role, string> = {
  OWNER:    "Full access — all pages, all OT stages",
  MANAGER:  "Full nav — OT access via flags below",
  HR:       "Full nav — OT access via flags below",
  EMPLOYEE: "Self-service portal only (/my)",
};

async function updateCompany(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const actor = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (actor?.role !== "OWNER") redirect("/settings?toast=Only+owners+can+update+company&toastType=error");
  if (!actor.companyId) redirect("/settings?toast=No+company+found&toastType=error");

  const name    = String(formData.get("companyName") ?? "").trim();
  const address = String(formData.get("companyAddress") ?? "").trim();
  if (!name) redirect("/settings?toast=Company+name+required&toastType=error");

  await prisma.company.update({ where: { id: actor.companyId }, data: { name, address } });
  redirect("/settings?toast=Company+info+updated&toastType=success");
}

async function updateUserRole(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const actor = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (actor?.role !== "OWNER") redirect("/settings?toast=Only+owners+can+change+roles&toastType=error");

  const userId = String(formData.get("userId"));
  const role   = String(formData.get("role"));
  if (!ROLES.includes(role as Role)) redirect("/settings?toast=Invalid+role&toastType=error");

  await prisma.user.update({ where: { id: userId }, data: { role } });
  redirect("/settings?toast=Role+updated&toastType=success");
}

async function updateOTPermissions(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const actor = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (actor?.role !== "OWNER") redirect("/settings?toast=Only+owners+can+change+permissions&toastType=error");

  const userId      = String(formData.get("userId"));
  const canPrepareOT = formData.get("canPrepareOT") === "1";
  const canCheckOT   = formData.get("canCheckOT")   === "1";
  const canApproveOT = formData.get("canApproveOT") === "1";

  await prisma.user.update({ where: { id: userId }, data: { canPrepareOT, canCheckOT, canApproveOT } });
  redirect("/settings?toast=OT+permissions+updated&toastType=success");
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const actor = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (actor?.role !== "OWNER") redirect("/dashboard");

  const company = await prisma.company.findUnique({ where: { id: actor.companyId ?? "" } });

  const users = await prisma.user.findMany({
    where: { companyId: actor.companyId ?? "" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, canPrepareOT: true, canCheckOT: true, canApproveOT: true },
  });

  const auditLogs = await prisma.auditLog.findMany({
    where: { companyId: actor.companyId ?? "" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[var(--text-tertiary)]" />
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Manage user roles and access.</p>
        </div>
        <Link href="/settings/holidays">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] hover:bg-[var(--neutral-bg)] transition-colors text-sm text-[var(--text-secondary)]">
            <CalendarDays className="h-4 w-4" />
            Holiday calendar
          </div>
        </Link>
      </div>

      {/* Company info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4 text-[var(--brand)]" />
            Company information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <form action={updateCompany} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Company name</label>
              <input
                name="companyName"
                defaultValue={company?.name ?? ""}
                required
                className="w-full h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Address</label>
              <input
                name="companyAddress"
                defaultValue={company?.address ?? ""}
                className="w-full h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>
            <SubmitButton size="sm">Save company info</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Role reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-[var(--brand)]" />
            Role permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 pt-3">
          {ROLES.map((r) => (
            <div key={r} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={ROLE_META[r].variant}>{ROLE_META[r].label}</Badge>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">{ROLE_PERMS[r]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* User role assignments */}
      <Card>
        <CardHeader>
          <CardTitle>User accounts</CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No user accounts found.</p>
          ) : (
            users.map((u) => {
              const meta = ROLE_META[u.role as Role] ?? ROLE_META.EMPLOYEE;
              return (
                <div key={u.id} className="py-2.5 border-b border-[var(--border)] last:border-0 space-y-3">
                  {/* User info + role */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name ?? u.email ?? "?"} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.name ?? "—"}</div>
                        <div className="text-xs text-[var(--text-tertiary)] truncate">{u.email}</div>
                      </div>
                    </div>
                    <form action={updateUserRole} className="flex items-center gap-2 flex-shrink-0">
                      <input type="hidden" name="userId" value={u.id} />
                      <Badge variant={meta.variant} className="hidden sm:flex">{meta.label}</Badge>
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_META[r].label}</option>
                        ))}
                      </select>
                      <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
                    </form>
                  </div>

                  {/* OT permissions (hidden for OWNER — they always have full access) */}
                  {u.role !== "OWNER" && (
                    <form action={updateOTPermissions} className="ml-11 flex flex-wrap items-center gap-4">
                      <input type="hidden" name="userId" value={u.id} />
                      <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mr-1">
                        <ClipboardCheck className="h-3 w-3" /> OT access:
                      </span>
                      {[
                        { key: "canPrepareOT", label: "Prepare", checked: u.canPrepareOT },
                        { key: "canCheckOT",   label: "Check",   checked: u.canCheckOT   },
                        { key: "canApproveOT", label: "Approve", checked: u.canApproveOT },
                      ].map(({ key, label, checked }) => (
                        <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            name={key}
                            value="1"
                            defaultChecked={checked}
                            className="h-3.5 w-3.5 rounded accent-[var(--brand)]"
                          />
                          {label}
                        </label>
                      ))}
                      <SubmitButton size="sm" variant="ghost" className="text-xs h-7 px-2">
                        Save
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-[var(--brand)]" />
            Audit log (last 50)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No activity recorded yet.</p>
          ) : (
            <div className="space-y-0 text-xs font-mono">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
                  <span className="text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
                    {new Date(log.createdAt).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="font-medium text-[var(--brand)] shrink-0">{log.action}</span>
                  {log.target && <span className="text-[var(--text-secondary)]">{log.target}{log.targetId ? ` · ${log.targetId.slice(-8)}` : ""}</span>}
                  {log.userId && <span className="text-[var(--text-tertiary)] truncate">uid:{log.userId.slice(-8)}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
