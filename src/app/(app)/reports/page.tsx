import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { php } from "@/lib/format";
import { computeSemiMonthlyPayroll } from "@/lib/ph-payroll";
import { ReportsCharts } from "./charts";

export default async function ReportsPage() {
  const employees = await prisma.employee.findMany({ where: { archived: false } });

  // Headcount by department
  const byDept = Object.entries(
    employees.reduce<Record<string, number>>((acc, e) => {
      acc[e.department] = (acc[e.department] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([department, count]) => ({ department, count }));

  // Tenure distribution
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

  // 6-month projected payroll cost trend (synthetic — based on current roster)
  const totalMonthly = employees.reduce((s, e) => {
    const half = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: new Date(), periodEnd: new Date() });
    return s + half.grossPay * 2;
  }, 0);
  const months = ["Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const payrollTrend = months.map((m, i) => ({ month: m, cost: Math.round(totalMonthly * (0.92 + i * 0.02)) }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reports & analytics</h1>
        <p className="text-sm text-muted-foreground">Headcount, payroll cost, tenure. Export to PDF/Excel from any panel.</p>
      </div>

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
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </CardContent></Card>
  );
}
