"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, Area, AreaChart,
} from "recharts";

// Two colour palettes — single brand accent + neutrals, no rainbows.
const BRAND = "var(--brand)";
const NEUTRALS = ["#6B6B6B", "#A3A3A3", "#CCCCCC", "#E5E5E5"];
const ALL_COLORS = [BRAND, ...NEUTRALS];

// Custom tooltip so we can apply the design system
function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string; currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 shadow-md text-xs">
      {label && <div className="text-[var(--text-tertiary)] mb-1">{label}</div>}
      <div className="font-semibold text-[var(--text-primary)]">
        {currency ? `₱${val.toLocaleString("en-PH")}` : val}
      </div>
    </div>
  );
}

interface Props {
  byDept: { department: string; count: number }[];
  tenureBuckets: { bucket: string; count: number }[];
  payrollTrend: { month: string; cost: number }[];
  compact?: boolean;
}

export function ReportsCharts({ byDept, tenureBuckets, payrollTrend, compact }: Props) {
  const chartH = compact ? 200 : 260;

  return (
    <div className={compact ? "space-y-4" : "grid md:grid-cols-2 gap-4"}>
      <Card>
        <CardHeader>
          <CardTitle>Payroll cost trend</CardTitle>
        </CardHeader>
        <CardContent className="pt-2" style={{ height: chartH + 48 }}>
          <ResponsiveContainer width="100%" height={chartH}>
            <AreaChart data={payrollTrend}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={BRAND} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<ChartTooltip currency />} />
              <Area
                type="monotone" dataKey="cost"
                stroke={BRAND} strokeWidth={2}
                fill="url(#pg)" dot={false}
                activeDot={{ r: 4, fill: BRAND, stroke: "var(--bg-elevated)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {!compact && (
        <>
          <Card>
            <CardHeader><CardTitle>Headcount by department</CardTitle></CardHeader>
            <CardContent className="pt-2" style={{ height: chartH + 48 }}>
              <ResponsiveContainer width="100%" height={chartH}>
                <BarChart data={byDept}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Tenure distribution</CardTitle></CardHeader>
            <CardContent className="pt-2" style={{ height: chartH + 48 }}>
              <ResponsiveContainer width="100%" height={chartH}>
                <PieChart>
                  <Pie
                    data={tenureBuckets} dataKey="count" nameKey="bucket"
                    cx="50%" cy="50%" outerRadius={90} paddingAngle={3}
                    label={({ bucket, percent }) => `${bucket} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {tenureBuckets.map((_, i) => (
                      <Cell key={i} fill={ALL_COLORS[i % ALL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
