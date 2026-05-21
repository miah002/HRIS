import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUTORY_LEAVE } from "@/lib/ph-payroll";
import { phDate } from "@/lib/format";

export default async function LeavePage() {
  const employees = await prisma.employee.findMany({ where: { archived: false }, take: 4 });
  const mockRequests = employees.map((e, i) => ({
    id: `mock-${i}`,
    employee: e,
    type: ["SIL", "PATERNITY", "MATERNITY", "BEREAVEMENT"][i % 4],
    start: new Date(Date.now() + i * 86400000 * 5),
    end: new Date(Date.now() + i * 86400000 * 5 + 86400000 * 2),
    status: i === 0 ? "PENDING" : i === 1 ? "APPROVED" : "PENDING",
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Leave management</h1>
        <p className="text-sm text-muted-foreground">Bakasyon — request, approve, and track balances.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Statutory leave entitlements</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {Object.entries(STATUTORY_LEAVE).map(([code, info]) => (
            <div key={code} className="rounded-lg border p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">{code.replace("_", " ")}</span>
                <Badge variant="outline">{info.days} days</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{info.ref}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pending requests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {mockRequests.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border-b last:border-0 pb-3 last:pb-0">
              <div>
                <div className="font-medium">{r.employee.firstName} {r.employee.lastName}</div>
                <div className="text-xs text-muted-foreground">{r.type} · {phDate(r.start)} → {phDate(r.end)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "APPROVED" ? "success" : "warning"}>{r.status}</Badge>
                {r.status === "PENDING" && (
                  <>
                    <Button size="sm" variant="outline">Reject</Button>
                    <Button size="sm">Approve</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Demo data — request → approve workflow is wired to the schema; email notification hook is stubbed.</p>
    </div>
  );
}
