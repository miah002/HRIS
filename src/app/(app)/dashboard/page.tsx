import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll } from "@/lib/ph-payroll";
import { Users, Wallet, CalendarCheck, ShieldAlert, PlayCircle, UserPlus, CheckCheck } from "lucide-react";

// Upcoming statutory deadlines (annual cadence — labels reflect typical filing dates).
// Sources: SSS Circular 2019-011 (PRN deadlines), PHIC PhilHealth Circular 2020-0005,
// HDMF Circular 274, BIR RR 11-2018 (1601-C), Section 2.83.1 RR 2-98 (2316 Jan 31).
function upcomingDeadlines(now: Date) {
  const month = now.getMonth();
  const year = now.getFullYear();
  const mk = (d: number, label: string, ref: string) => ({ date: new Date(year, month, d), label, ref });
  return [
    mk(10, "BIR Form 1601-C (Monthly WHT on comp.)", "BIR RR 11-2018"),
    mk(10, "Pag-IBIG (HDMF) remittance", "HDMF Circular 274"),
    mk(11, "PhilHealth premium remittance", "PHIC Circ. 2020-0005"),
    mk(31, "SSS contribution payment", "SSS Circ. 2019-011"),
  ].filter((d) => d.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

export default async function DashboardPage() {
  const employees = await prisma.employee.findMany({ where: { archived: false } });
  const headcount = employees.length;
  const pendingLeaves = await prisma.leaveRequest.count({ where: { status: "PENDING" } });

  // Project monthly payroll cost using the PH payroll engine (sum of grossPay across employees, full month = 2 cutoffs).
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthlyPayroll = employees.reduce((sum, e) => {
    const half = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart, periodEnd });
    return sum + half.grossPay * 2;
  }, 0);

  const deadlines = upcomingDeadlines(now).slice(0, 4);
  const recentHires = [...employees].sort((a, b) => +b.dateHired - +a.dateHired).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Kumusta! Here&rsquo;s your business at a glance.</h1>
        <p className="text-muted-foreground text-sm mt-1">Period {phDate(periodStart)} – {phDate(periodEnd)}</p>
      </div>

      {/* KPI cards — stack vertically on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={Users} label="Employees" value={String(headcount)} sub="Active headcount" />
        <Kpi icon={Wallet} label="Monthly payroll" value={php(monthlyPayroll)} sub="Projected gross" />
        <Kpi icon={CalendarCheck} label="Pending leaves" value={String(pendingLeaves)} sub="Awaiting approval" />
        <Kpi icon={ShieldAlert} label="Next deadline" value={deadlines[0] ? phDate(deadlines[0].date) : "—"} sub={deadlines[0]?.label ?? "All clear"} />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/payroll"><Button><PlayCircle className="h-4 w-4" />Run payroll</Button></Link>
          <Link href="/employees/new"><Button variant="outline"><UserPlus className="h-4 w-4" />Add employee</Button></Link>
          <Link href="/leave"><Button variant="outline"><CheckCheck className="h-4 w-4" />Approve leaves</Button></Link>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming statutory deadlines</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deadlines.length === 0 && <p className="text-sm text-muted-foreground">Nothing this month.</p>}
            {deadlines.map((d) => (
              <div key={d.label} className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="text-xs text-muted-foreground">{d.ref}</div>
                </div>
                <Badge variant="warning">{phDate(d.date)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent hires</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentHires.map((e) => (
              <Link key={e.id} href={`/employees/${e.id}`} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium">{e.firstName} {e.lastName}</div>
                  <div className="text-xs text-muted-foreground">{e.position} · {e.department}</div>
                </div>
                <Badge variant="muted">{phDate(e.dateHired)}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-xl md:text-2xl font-bold">{value}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
