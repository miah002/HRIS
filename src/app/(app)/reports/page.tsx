import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { php } from "@/lib/format";
import { computeSemiMonthlyPayroll } from "@/lib/ph-payroll";
import { ReportsCharts } from "./charts";
import { ComplianceDownloads } from "./compliance-downloads";
import { FileSpreadsheet, Table2, Gift, FileText, CalendarCheck } from "lucide-react";

export default async function ReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const employees = await prisma.employee.findMany({ where: { companyId, archived: false } });

  const byDept = Object.entries(
    employees.reduce<Record<string, number>>((acc, e) => {
      acc[e.department] = (acc[e.department] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([department, count]) => ({ department, count }));

  const tenureBuckets = [
    { bucket: "<1y", count: 0 },
    { bucket: "1–2y", count: 0 },
    { bucket: "3–5y", count: 0 },
    { bucket: "5y+", count: 0 },
  ];
  employees.forEach((e) => {
    const years = (Date.now() - +e.dateHired) / (1000 * 60 * 60 * 24 * 365.25);
    if (years < 1) tenureBuckets[0].count++;
    else if (years < 3) tenureBuckets[1].count++;
    else if (years <= 5) tenureBuckets[2].count++;
    else tenureBuckets[3].count++;
  });

  const totalMonthly = employees.reduce((s, e) => {
    const half = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: new Date(), periodEnd: new Date() });
    return s + half.grossPay * 2;
  }, 0);

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const payrollHistory = await prisma.payroll.findMany({
    where: { employee: { companyId }, periodStart: { gte: sixMonthsAgo } },
    select: { periodStart: true, grossPay: true },
  });
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthMap = new Map<string, number>();
  for (const p of payrollHistory) {
    const key = `${p.periodStart.getFullYear()}-${p.periodStart.getMonth()}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + p.grossPay);
  }
  const payrollTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    return { month: MONTH_LABELS[d.getMonth()], cost: monthMap.get(key) ?? 0 };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & analytics</h1>
        <p className="text-sm text-[var(--text-secondary)]">Headcount, payroll cost, tenure, and statutory compliance reports.</p>
      </div>

      {/* Quick links to report pages */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/reports/pay-register", icon: Table2, title: "Pay Register", desc: "Full payroll run detail — all employees, all line items" },
          { href: "/reports/13th-month", icon: Gift, title: "13th Month Pay", desc: "Annual computation per employee, DOLE-compliant" },
          { href: "/reports/2316", icon: FileText, title: "BIR Form 2316", desc: "Annual certificate of compensation per employee for BIR filing" },
          { href: "/reports/leave", icon: CalendarCheck, title: "Leave Summary", desc: "VL / SL balances and approved leave log by year" },
        ].map(({ href, icon: Icon, title, desc }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-[var(--brand)] transition-colors cursor-pointer h-full">
              <CardContent className="pt-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--brand-subtle)] grid place-items-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-[var(--brand)]" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{title}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Government compliance CSV downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[var(--brand)]" />
            Government Compliance Reports
          </CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">Download CSV files for submission to SSS, PhilHealth, Pag-IBIG, and BIR.</p>
        </CardHeader>
        <CardContent>
          <ComplianceDownloads />
        </CardContent>
      </Card>

      {/* Analytics */}
      <div className="grid md:grid-cols-3 gap-3">
        <Mini label="Headcount" value={String(employees.length)} />
        <Mini label="Avg. monthly rate" value={php(employees.reduce((s, e) => s + e.basicMonthlyRate, 0) / Math.max(1, employees.length))} />
        <Mini label="Projected monthly payroll" value={php(totalMonthly)} />
      </div>

      <ReportsCharts byDept={byDept} tenureBuckets={tenureBuckets} payrollTrend={payrollTrend} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-4">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </CardContent></Card>
  );
}
