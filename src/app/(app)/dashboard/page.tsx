import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, OT_RATES, hourlyRate } from "@/lib/ph-payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { KpiCard } from "./kpi-card";
import { Greeting } from "./greeting";
import { PlayCircle, UserPlus, CheckCheck, AlertTriangle, Clock } from "lucide-react";
import { ReportsCharts } from "../reports/charts";

function currentCutoff(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (d <= 15) return { start: new Date(y, m, 1), end: new Date(y, m, 15), label: `${now.toLocaleString("en-PH", { month: "long" })} 1–15` };
  return { start: new Date(y, m, 16), end: new Date(y, m + 1, 0), label: `${now.toLocaleString("en-PH", { month: "long" })} 16–end` };
}

function upcomingDeadlines(now: Date) {
  const m = now.getMonth(); const y = now.getFullYear();
  const mk = (d: number, label: string, ref: string) => ({ date: new Date(y, m, d), label, ref });
  return [
    mk(10, "BIR Form 1601-C",     "Monthly WHT on compensation"),
    mk(10, "Pag-IBIG remittance", "HDMF employer share"),
    mk(11, "PhilHealth premium",  "PHIC employer share"),
    mk(31, "SSS contribution",    "PRN-based payment"),
  ].filter((d) => d.date >= new Date(y, m, now.getDate()))
   .sort((a, b) => +a.date - +b.date);
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Employees have their own portal — redirect them away from the owner dashboard
  const { prisma: db } = await import("@/lib/prisma");
  const user = await db.user.findUnique({ where: { email: session.user!.email! } });
  if (user?.role === "EMPLOYEE") redirect("/my");

  const name = session?.user?.name?.split(" ")[0] ?? "Owner";

  const employees = await prisma.employee.findMany({ where: { archived: false } });
  const pendingLeaves = await prisma.leaveRequest.count({ where: { status: "PENDING" } });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthlyPayroll = employees.reduce((s, e) => {
    const half = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: start, periodEnd: end });
    return s + half.grossPay * 2;
  }, 0);

  const deadlines = upcomingDeadlines(now);

  // Sparkline: 6-month payroll trend (synthetic baseline — real impl reads DB history)
  const spark = [0.91, 0.95, 0.97, 0.98, 1.0, 1.0].map((x) => Math.round(monthlyPayroll * x));

  // Recharts data
  const byDept = Object.entries(
    employees.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.department]: (acc[e.department] ?? 0) + 1 }), {})
  ).map(([department, count]) => ({ department, count }));

  const months = ["Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const payrollTrend = months.map((m, i) => ({ month: m, cost: Math.round(monthlyPayroll * (0.91 + i * 0.018)) }));

  const tenureBuckets = [
    { bucket: "<1y", count: 0 }, { bucket: "1–2y", count: 0 }, { bucket: "3–5y", count: 0 }, { bucket: "5y+", count: 0 }
  ];
  employees.forEach((e) => {
    const y = (Date.now() - +e.dateHired) / (1000 * 60 * 60 * 24 * 365.25);
    if (y < 1) tenureBuckets[0].count++;
    else if (y < 3) tenureBuckets[1].count++;
    else if (y <= 5) tenureBuckets[2].count++;
    else tenureBuckets[3].count++;
  });

  const recentHires = [...employees].sort((a, b) => +b.dateHired - +a.dateHired).slice(0, 5);

  // OT summary for current cutoff
  const cutoff = currentCutoff(now);
  const cutoffAttendance = await prisma.attendance.findMany({
    where: { date: { gte: cutoff.start, lte: cutoff.end } },
    include: { employee: true },
  });

  const otByEmployee = new Map<string, { name: string; otHrs: number; otPay: number }>();
  for (const row of cutoffAttendance) {
    if ((row.otHours ?? 0) <= 0) continue;
    const hr = hourlyRate(row.employee.basicMonthlyRate);
    const code = row.otRateCode ?? "R_OT";
    const pay = Math.round((row.otHours ?? 0) * hr * (OT_RATES[code] ?? 1.25) * 100) / 100;
    const existing = otByEmployee.get(row.employeeId);
    if (existing) {
      existing.otHrs += row.otHours ?? 0;
      existing.otPay += pay;
    } else {
      otByEmployee.set(row.employeeId, {
        name: `${row.employee.lastName}, ${row.employee.firstName}`,
        otHrs: row.otHours ?? 0,
        otPay: pay,
      });
    }
  }
  const otRows = [...otByEmployee.values()].sort((a, b) => b.otHrs - a.otHrs);
  const totalOtHrs = otRows.reduce((s, r) => s + r.otHrs, 0);
  const totalOtPay = otRows.reduce((s, r) => s + r.otPay, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-lg font-medium text-[var(--text-secondary)]">
          <Greeting name={name} />
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
          {phDate(start)} – {phDate(end)}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Employees" sublabel="Mga Empleyado"
          value={employees.length}
          delta={2.3}
          sparkData={[10, 11, 11, 12, 13, employees.length]}
          delay={0}
        />
        <KpiCard
          label="Monthly payroll" sublabel="Gross"
          value={Math.round(monthlyPayroll)}
          format="currencyK"
          delta={1.8}
          sparkData={spark}
          delay={0.04}
        />
        <KpiCard
          label="Pending leaves" sublabel="Bakasyon"
          value={pendingLeaves}
          delta={pendingLeaves > 0 ? undefined : 0}
          delay={0.08}
        />
        <KpiCard
          label="Days to deadline" sublabel={deadlines[0]?.label ?? "All clear"}
          value={deadlines[0] ? Math.max(1, Math.ceil((+deadlines[0].date - +now) / 86400000)) : 0}
          format="days"
          delay={0.12}
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/payroll">
          <Button size="sm"><PlayCircle className="h-3.5 w-3.5" />Run payroll</Button>
        </Link>
        <Link href="/employees/new">
          <Button size="sm" variant="secondary"><UserPlus className="h-3.5 w-3.5" />Add employee</Button>
        </Link>
        <Link href="/leave">
          <Button size="sm" variant="secondary"><CheckCheck className="h-3.5 w-3.5" />Approve leaves</Button>
        </Link>
      </div>

      {/* OT summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-[var(--brand)]" />
            Overtime — {cutoff.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex gap-8 mb-4">
            <div>
              <div className="text-2xs text-[var(--text-tertiary)] uppercase tracking-wide">Total OT hours</div>
              <div className="text-xl font-semibold tabular mt-0.5">{totalOtHrs.toFixed(1)}h</div>
            </div>
            <div>
              <div className="text-2xs text-[var(--text-tertiary)] uppercase tracking-wide">Est. OT pay</div>
              <div className="text-xl font-semibold tabular mt-0.5 text-[var(--brand)]">{php(totalOtPay)}</div>
            </div>
          </div>
          {otRows.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)]">No overtime recorded for this cutoff.</p>
          ) : (
            <div className="space-y-1">
              {otRows.map((r) => (
                <div key={r.name} className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
                  <span className="text-sm">{r.name}</span>
                  <div className="flex items-center gap-4 text-sm tabular text-[var(--text-secondary)] flex-shrink-0">
                    <span>{r.otHrs.toFixed(1)}h</span>
                    <span className="text-[var(--brand)] font-medium">{php(r.otPay)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts + Deadlines */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ReportsCharts byDept={byDept} tenureBuckets={tenureBuckets} payrollTrend={payrollTrend} compact />
        </div>

        <Card>
          <CardHeader><CardTitle>Upcoming deadlines</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-3">
            {deadlines.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">No deadlines this month.</p>
            )}
            {deadlines.map((d, i) => {
              const days = Math.max(1, Math.ceil((+d.date - +now) / 86400000));
              return (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[var(--warning)]" />
                    <div>
                      <div className="text-xs font-medium">{d.label}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">{d.ref}</div>
                    </div>
                  </div>
                  <Badge variant={days <= 3 ? "warning" : "neutral"} className="flex-shrink-0">
                    {days === 1 ? "Tomorrow" : `${days}d`}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent hires */}
      <Card>
        <CardHeader>
          <CardTitle>Recent team members</CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {recentHires.map((e) => (
            <Link
              key={e.id}
              href={`/employees/${e.id}`}
              className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-[var(--radius-sm)] hover:bg-[var(--neutral-bg)] transition-colors duration-fast"
            >
              <Avatar name={`${e.firstName} ${e.lastName}`} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.firstName} {e.lastName}</div>
                <div className="text-xs text-[var(--text-tertiary)] truncate">{e.position} · {e.department}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <Badge variant={e.employmentStatus === "REGULAR" ? "success" : "default"}>
                  {e.employmentStatus}
                </Badge>
                <div className="text-[10px] text-[var(--text-tertiary)] mt-1">{phDate(e.dateHired)}</div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
