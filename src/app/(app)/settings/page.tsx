import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Settings, ShieldAlert } from "lucide-react";

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
  MANAGER:  "Full nav — OT prepare, check, approve",
  HR:       "Full nav — OT prepare and check only",
  EMPLOYEE: "Self-service portal only (/my)",
};

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

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const actor = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (actor?.role !== "OWNER") redirect("/dashboard");

  const users = await prisma.user.findMany({
    where: { companyId: actor.companyId ?? "" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
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
      </div>

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
                <div key={u.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
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
                    <Button type="submit" size="sm" variant="secondary">Save</Button>
                  </form>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
