import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { phDate } from "@/lib/format";
import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

const DEADLINES = [
  { label: "BIR Form 1601-C", sub: "Monthly WHT on compensation", day: 10, ref: "BIR RR 11-2018", cadence: "Monthly" },
  { label: "Pag-IBIG remittance", sub: "HDMF employer share", day: 10, ref: "HDMF Circular 274", cadence: "Monthly" },
  { label: "PhilHealth premium", sub: "PHIC employer share", day: 11, ref: "PHIC Circular 2020-0005", cadence: "Monthly" },
  { label: "SSS contribution", sub: "PRN-based payment", day: 31, ref: "SSS Circular 2019-011", cadence: "Monthly" },
  { label: "BIR Form 2316", sub: "Distribute to employees", day: 31, ref: "Sec. 2.83.1, RR 2-98", cadence: "Annual · Jan 31" },
  { label: "BIR Form 1604-C", sub: "Annual info return", day: 31, ref: "BIR RR 11-2018", cadence: "Annual · Jan 31" },
];

export default function CompliancePage() {
  const now = new Date();
  const items = DEADLINES.map((d) => {
    const due = new Date(now.getFullYear(), now.getMonth(), d.day);
    if (due < now && d.cadence === "Monthly") due.setMonth(due.getMonth() + 1);
    const daysLeft = Math.ceil((+due - +now) / 86400000);
    return { ...d, due, daysLeft };
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--text-tertiary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">Statutory remittance & BIR filing deadlines for your business.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-[var(--success)]">
              <CheckCircle2 className="h-4 w-4" /><span className="text-sm font-medium">On track</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">No overdue remittances.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-[var(--warning)]">
              <AlertTriangle className="h-4 w-4" /><span className="text-sm font-medium">{items.filter(i => i.daysLeft <= 7).length} due this week</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Action needed soon.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--brand)]" /><span className="text-sm font-medium">RA 10173 ready</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Data Privacy Act notice published.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Upcoming deadlines</CardTitle></CardHeader>
        <CardContent className="pt-3 space-y-1">
          {items.map((d) => (
            <div key={d.label} className="flex items-center justify-between gap-3 py-3 border-b border-[var(--border)] last:border-0">
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${d.daysLeft <= 3 ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{d.sub} · {d.ref} · {d.cadence}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <Badge variant={d.daysLeft <= 3 ? "warning" : "neutral"}>{phDate(d.due)}</Badge>
                <div className="text-[10px] text-[var(--text-tertiary)] mt-1">in {d.daysLeft} day{d.daysLeft === 1 ? "" : "s"}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Document expiry tracking</CardTitle></CardHeader>
        <CardContent className="pt-3 text-sm text-[var(--text-tertiary)]">
          No upcoming expirations. Tracks employee contracts, AEPs for foreign hires, and kasambahay agreements (RA 10361).
        </CardContent>
      </Card>
    </div>
  );
}
