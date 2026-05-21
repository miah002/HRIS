import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { STATUTORY_LEAVE } from "@/lib/ph-payroll";
import { phDate } from "@/lib/format";
import { CalendarCheck } from "lucide-react";

export default async function LeavePage() {
  const employees = await prisma.employee.findMany({ where: { archived: false }, take: 4 });
  const mockRequests = employees.map((e, i) => ({
    id: `mock-${i}`,
    employee: e,
    type: ["SIL", "PATERNITY", "MATERNITY", "BEREAVEMENT"][i % 4],
    start: new Date(Date.now() + i * 86400000 * 5),
    end: new Date(Date.now() + i * 86400000 * 5 + 86400000 * 2),
    status: i === 1 ? "APPROVED" : "PENDING",
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-[var(--text-tertiary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Leave management</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">Bakasyon — request, approve, and track balances.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Statutory leave entitlements</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(STATUTORY_LEAVE).map(([code, info]) => (
            <div key={code} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{code.replace("_", " ")}</span>
                <Badge variant="brand">{info.days}d</Badge>
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1 leading-relaxed">{info.ref}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pending requests</CardTitle></CardHeader>
        <CardContent className="pt-3 space-y-2">
          {mockRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={`${r.employee.firstName} ${r.employee.lastName}`} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.employee.firstName} {r.employee.lastName}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{r.type} · {phDate(r.start)} → {phDate(r.end)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                {r.status === "PENDING" && (
                  <>
                    <Button size="sm" variant="secondary">Reject</Button>
                    <Button size="sm">Approve</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-2xs text-[var(--text-tertiary)]">
        Demo data — request → approve workflow is modeled in the schema; email notification hook is stubbed.
      </p>
    </div>
  );
}
