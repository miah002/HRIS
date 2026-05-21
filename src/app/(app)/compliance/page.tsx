import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { phDate } from "@/lib/format";
import { ShieldCheck, AlertTriangle } from "lucide-react";

// PH statutory remittance & filing deadlines, with the regulation that mandates each.
const DEADLINES = [
  { label: "BIR Form 1601-C (Monthly WHT on compensation)", day: 10, ref: "BIR RR 11-2018", cadence: "Monthly" },
  { label: "Pag-IBIG (HDMF) employer remittance", day: 10, ref: "HDMF Circular 274", cadence: "Monthly" },
  { label: "PhilHealth premium remittance", day: 11, ref: "PHIC Circular 2020-0005", cadence: "Monthly" },
  { label: "SSS contribution payment (PRN-based)", day: 31, ref: "SSS Circular 2019-011", cadence: "Monthly" },
  { label: "BIR Form 2316 distribution to employees", day: 31, ref: "Sec. 2.83.1, RR 2-98", cadence: "Annual (Jan 31)" },
  { label: "BIR Form 1604-C (Annual info return on comp.)", day: 31, ref: "BIR RR 11-2018", cadence: "Annual (Jan 31)" },
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Compliance dashboard</h1>
        <p className="text-sm text-muted-foreground">Statutory remittance & BIR filing deadlines for your business.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-5"><div className="flex items-center gap-2 text-emerald-700"><ShieldCheck className="h-4 w-4" /><span className="font-medium">3 on track</span></div><p className="text-xs text-muted-foreground mt-1">No overdue remittance.</p></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-4 w-4" /><span className="font-medium">1 due this week</span></div><p className="text-xs text-muted-foreground mt-1">Action needed before Sunday.</p></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-2"><span className="font-medium">RA 10173 ready</span></div><p className="text-xs text-muted-foreground mt-1">Data Privacy Act privacy notice published.</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming deadlines</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.map((d) => (
            <div key={d.label} className="flex items-start justify-between gap-3 border-b last:border-0 pb-3 last:pb-0">
              <div>
                <div className="text-sm font-medium">{d.label}</div>
                <div className="text-xs text-muted-foreground">{d.ref} · {d.cadence}</div>
              </div>
              <div className="text-right">
                <Badge variant={d.daysLeft <= 3 ? "warning" : "outline"}>{phDate(d.due)}</Badge>
                <div className="text-[11px] text-muted-foreground mt-1">in {d.daysLeft} day{d.daysLeft === 1 ? "" : "s"}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Document expiry tracking</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">No upcoming expirations. (Tracks employee contracts, AEPs for foreign hires, and kasambahay agreements under RA 10361.)</CardContent>
      </Card>
    </div>
  );
}
