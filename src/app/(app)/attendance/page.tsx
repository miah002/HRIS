import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
import { OT_RATES } from "@/lib/ph-payroll";
import { Clock, LogIn, LogOut, PlusCircle } from "lucide-react";

const OT_RATE_OPTIONS: { value: string; label: string; group: string }[] = [
  { value: "R_OT",     label: "R OT — Regular OT (×1.25)",                      group: "Regular OT" },
  { value: "RD",       label: "RD — Rest Day (×1.30)",                           group: "Rest Day" },
  { value: "RD_OT",    label: "RD OT — Rest Day OT (×1.69)",                     group: "Rest Day" },
  { value: "SH",       label: "SH — Special Holiday (×1.30)",                    group: "Special Holiday" },
  { value: "SH_OT",    label: "SH OT — Special Holiday OT (×1.69)",              group: "Special Holiday" },
  { value: "SH_RD",    label: "SH RD — Special Holiday Rest Day (×1.50)",        group: "Special Holiday" },
  { value: "SH_RD_OT", label: "SH RD OT — Special Holiday Rest Day OT (×1.95)", group: "Special Holiday" },
  { value: "RH",       label: "RH — Regular Holiday (×2.00)",                    group: "Regular Holiday" },
  { value: "RH_OT",    label: "RH OT — Regular Holiday OT (×2.60)",              group: "Regular Holiday" },
  { value: "RH_RD",    label: "RH RD — Regular Holiday Rest Day (×2.60)",        group: "Regular Holiday" },
  { value: "RH_RD_OT", label: "RH RD OT — Regular Holiday Rest Day OT (×3.38)", group: "Regular Holiday" },
  { value: "ND",       label: "ND — Night Differential (×1.10)",                 group: "Night Differential" },
  { value: "ND_OT",    label: "ND OT — Night Differential OT (×1.38)",           group: "Night Differential" },
  { value: "ND_SH",    label: "ND SH — Night Diff on Special Holiday (×1.43)",   group: "Night Differential" },
  { value: "ND_SH_OT", label: "ND SH OT — Night Diff Sp. Holiday OT (×1.86)",   group: "Night Differential" },
  { value: "ND_RH",    label: "ND RH — Night Diff on Regular Holiday (×2.20)",   group: "Night Differential" },
  { value: "ND_RH_OT", label: "ND RH OT — Night Diff Reg. Holiday OT (×2.86)",  group: "Night Differential" },
];

function currentCutoff(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (d <= 15) return { start: new Date(y, m, 1), end: new Date(y, m, 15), label: `${now.toLocaleString("en-PH", { month: "long" })} 1–15` };
  return { start: new Date(y, m, 16), end: new Date(y, m + 1, 0), label: `${now.toLocaleString("en-PH", { month: "long" })} 16–end` };
}

function lastCutoff(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (d <= 15) return { start: new Date(y, m - 1, 16), end: new Date(y, m, 0) };
  return { start: new Date(y, m, 1), end: new Date(y, m, 15) };
}

function todayPH() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
}

async function timeIn(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const employeeId = String(formData.get("employeeId"));
  const date = todayPH();
  const now = new Date();
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { timeIn: now },
    create: {
      employeeId, date,
      timeIn: now, timeOut: null, hoursWorked: 0,
      otHours: 0, ndHours: 0,
    },
  });
  redirect("/attendance");
}

async function timeOut(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const employeeId = String(formData.get("employeeId"));
  const date = todayPH();
  const now = new Date();
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
  const timeInDt = existing?.timeIn ?? now;
  const hoursWorked = Math.max(0, (now.getTime() - timeInDt.getTime()) / (1000 * 60 * 60));
  const otHours = Math.max(0, hoursWorked - 8);
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { timeOut: now, hoursWorked: Math.round(hoursWorked * 100) / 100, otHours: Math.round(otHours * 100) / 100 },
    create: {
      employeeId, date,
      timeIn: timeInDt, timeOut: now,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours: Math.round(otHours * 100) / 100,
      ndHours: 0,
    },
  });
  redirect("/attendance");
}

async function logManual(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const employeeId = String(formData.get("employeeId"));
  const dateStr = String(formData.get("date"));
  const timeInStr = String(formData.get("timeIn"));
  const timeOutStr = String(formData.get("timeOut"));

  const date = new Date(dateStr + "T00:00:00");
  const [inH, inM] = timeInStr.split(":").map(Number);
  const [outH, outM] = timeOutStr.split(":").map(Number);

  const timeInDt = new Date(date); timeInDt.setHours(inH, inM, 0, 0);
  const timeOutDt = new Date(date); timeOutDt.setHours(outH, outM, 0, 0);
  const hoursWorked = Math.max(0, (timeOutDt.getTime() - timeInDt.getTime()) / (1000 * 60 * 60));
  const otHours = Math.max(0, hoursWorked - 8);
  const otRateCode = formData.get("otRateCode") as string | null;

  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: {
      timeIn: timeInDt, timeOut: timeOutDt,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours: Math.round(otHours * 100) / 100,
      isRestDay: formData.get("isRestDay") === "on",
      isHoliday: formData.get("isHoliday") === "on",
      otRateCode: otRateCode || null,
    },
    create: {
      employeeId, date,
      timeIn: timeInDt, timeOut: timeOutDt,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours: Math.round(otHours * 100) / 100,
      ndHours: 0,
      isRestDay: formData.get("isRestDay") === "on",
      isHoliday: formData.get("isHoliday") === "on",
      otRateCode: otRateCode || null,
    },
  });
  redirect("/attendance");
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });

  const companyId = user?.companyId ?? "";

  const params = await searchParams;
  const tab = params.tab ?? "today";

  // History filter params
  const period = params.period ?? "current";
  const histEmployeeId = params.employeeId ?? "";
  const now = new Date();
  let histFrom: Date, histTo: Date, histLabel: string;
  if (period === "last") {
    const lc = lastCutoff(now);
    histFrom = lc.start; histTo = lc.end;
    histLabel = "Last cutoff";
  } else if (period === "custom" && params.from && params.to) {
    histFrom = new Date(params.from + "T00:00:00");
    histTo   = new Date(params.to   + "T23:59:59");
    histLabel = `${params.from} – ${params.to}`;
  } else {
    const cc = currentCutoff(now);
    histFrom = cc.start; histTo = cc.end;
    histLabel = `Current cutoff (${cc.label})`;
  }

  const histRecords = tab === "history"
    ? await prisma.attendance.findMany({
        where: {
          employee: { companyId },
          date: { gte: histFrom, lte: histTo },
          ...(histEmployeeId ? { employeeId: histEmployeeId } : {}),
        },
        include: { employee: true },
        orderBy: [{ employee: { lastName: "asc" } }, { date: "asc" }],
      })
    : [];

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
    orderBy: { firstName: "asc" },
  });

  const today = todayPH();
  const todayRecords = await prisma.attendance.findMany({
    where: {
      date: today,
      employee: { companyId },
    },
    include: { employee: true },
  });

  const recordMap = new Map(todayRecords.map((r) => [r.employeeId, r]));

  const rows = employees.map((e) => {
    const rec = recordMap.get(e.id);
    const status = !rec ? "Absent" : !rec.timeIn ? "Absent" : !rec.timeOut ? "In progress" : rec.hoursWorked < 8 ? "Late / Short" : "Present";
    return { e, rec, status };
  });

  const presentCount = rows.filter((r) => r.status === "Present" || r.status === "In progress").length;
  const absentCount = rows.filter((r) => r.status === "Absent").length;
  const todayLabel = today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[var(--text-tertiary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">Daily Time Record · {todayLabel}</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-0 border-b border-[var(--border)]">
        {[
          { label: "Today", value: "today" },
          { label: "History", value: "history" },
        ].map((t) => (
          <Link
            key={t.value}
            href={`/attendance?tab=${t.value}`}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── TODAY TAB ── */}
      {tab !== "history" && (
      <>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">Present today</div>
            <div className="text-2xl font-semibold mt-1 text-[var(--success)]">{presentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">Absent</div>
            <div className="text-2xl font-semibold mt-1 text-[var(--error)]">{absentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">Total employees</div>
            <div className="text-2xl font-semibold mt-1">{employees.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick clock-in/out per employee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--brand)]" /> Today&apos;s clock-in / clock-out
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Status</Th>
                <Th>Time in</Th>
                <Th>Time out</Th>
                <Th className="text-right">Hours</Th>
                <Th className="text-right">OT</Th>
                <Th>Rate</Th>
                <Th></Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ e, rec, status }) => (
                <TableRow key={e.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={`${e.firstName} ${e.lastName}`} size="sm" />
                      <span className="text-sm font-medium">{e.lastName}, {e.firstName}</span>
                    </div>
                  </Td>
                  <Td>
                    <Badge
                      dot
                      variant={
                        status === "Present" ? "success" :
                        status === "In progress" ? "brand" :
                        status === "Late / Short" ? "warning" : "neutral"
                      }
                    >
                      {status}
                    </Badge>
                  </Td>
                  <Td className="tabular text-[var(--text-secondary)]">{fmt(rec?.timeIn ?? null)}</Td>
                  <Td className="tabular text-[var(--text-secondary)]">{fmt(rec?.timeOut ?? null)}</Td>
                  <Td numeric className="text-[var(--text-secondary)]">
                    {rec?.hoursWorked ? `${rec.hoursWorked.toFixed(1)}h` : "—"}
                  </Td>
                  <Td numeric className="text-[var(--text-secondary)]">
                    {rec?.otHours ? `${rec.otHours.toFixed(1)}h` : "—"}
                  </Td>
                  <Td>
                    {rec?.otRateCode
                      ? <Badge variant="neutral">{rec.otRateCode.replace(/_/g, " ")}</Badge>
                      : <span className="text-[var(--text-tertiary)]">—</span>
                    }
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 justify-end">
                      {!rec?.timeIn && (
                        <form action={timeIn}>
                          <input type="hidden" name="employeeId" value={e.id} />
                          <Button size="sm" type="submit">
                            <LogIn className="h-3 w-3" />Time in
                          </Button>
                        </form>
                      )}
                      {rec?.timeIn && !rec?.timeOut && (
                        <form action={timeOut}>
                          <input type="hidden" name="employeeId" value={e.id} />
                          <Button size="sm" variant="secondary" type="submit">
                            <LogOut className="h-3 w-3" />Time out
                          </Button>
                        </form>
                      )}
                      {rec?.timeIn && rec?.timeOut && (
                        <span className="text-xs text-[var(--text-tertiary)]">Done</span>
                      )}
                    </div>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-[var(--brand)]" /> Manual attendance entry
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <form action={logManual} className="grid sm:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Employee</label>
              <select
                name="employeeId" required
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Date</label>
              <input
                type="date" name="date" required
                defaultValue={today.toISOString().split("T")[0]}
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Time in</label>
              <input
                type="time" name="timeIn" required defaultValue="08:00"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Time out</label>
              <input
                type="time" name="timeOut" required defaultValue="17:00"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Rate Code</label>
              <select
                name="otRateCode"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">— None (regular day) —</option>
                {["Regular OT", "Rest Day", "Special Holiday", "Regular Holiday", "Night Differential"].map((group) => (
                  <optgroup key={group} label={group}>
                    {OT_RATE_OPTIONS.filter((o) => o.group === group).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Flags</label>
              <div className="flex items-center gap-3 h-10">
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" name="isRestDay" className="rounded" /> Rest day
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" name="isHoliday" className="rounded" /> Holiday
                </label>
              </div>
            </div>
            <div className="sm:col-span-3 lg:col-span-7 flex justify-end">
              <Button type="submit" size="sm">Save attendance</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-2xs text-[var(--text-tertiary)]">
        OT computed automatically: hours beyond 8 = regular OT at ×{OT_RATES.R_OT} (Labor Code Art. 87).
        Use manual entry to tag rest-day, holiday, or night differential rate codes — these flow into the correct payslip buckets at payroll run.
      </p>

      </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div className="space-y-5">
          {/* Filter form */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <form method="GET" className="flex flex-wrap gap-3 items-end">
                <input type="hidden" name="tab" value="history" />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Period</label>
                  <select
                    name="period"
                    defaultValue={period}
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  >
                    <option value="current">Current cutoff</option>
                    <option value="last">Last cutoff</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">From</label>
                  <input
                    type="date" name="from"
                    defaultValue={params.from ?? histFrom.toISOString().split("T")[0]}
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">To</label>
                  <input
                    type="date" name="to"
                    defaultValue={params.to ?? histTo.toISOString().split("T")[0]}
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Employee</label>
                  <select
                    name="employeeId"
                    defaultValue={histEmployeeId}
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  >
                    <option value="">All employees</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>
                    ))}
                  </select>
                </div>

                <Button type="submit" size="sm">View</Button>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {histRecords.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm font-medium">No attendance records found</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {histLabel} · {histEmployeeId ? "Selected employee" : "All employees"}
                </p>
                <Link href="/attendance" className="mt-3 inline-block text-xs text-[var(--brand)] hover:underline">
                  Log manual entry →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {histLabel} · {histRecords.length} record{histRecords.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <Th>Employee</Th>
                      <Th>Date</Th>
                      <Th>Day</Th>
                      <Th>Time in</Th>
                      <Th>Time out</Th>
                      <Th className="text-right">Hrs</Th>
                      <Th className="text-right">OT</Th>
                      <Th>Rate</Th>
                      <Th>Status</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histRecords.map((rec) => {
                      const status =
                        !rec.timeIn ? "Absent"
                        : !rec.timeOut ? "In progress"
                        : rec.hoursWorked < 8 ? "Late / Short"
                        : "Present";
                      return (
                        <TableRow key={rec.id}>
                          <Td>
                            <span className="text-sm font-medium">
                              {rec.employee.lastName}, {rec.employee.firstName}
                            </span>
                          </Td>
                          <Td className="text-[var(--text-secondary)]">
                            {rec.date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                          </Td>
                          <Td className="text-[var(--text-secondary)]">
                            {rec.date.toLocaleDateString("en-PH", { weekday: "short" })}
                          </Td>
                          <Td className="tabular text-[var(--text-secondary)]">{fmt(rec.timeIn)}</Td>
                          <Td className="tabular text-[var(--text-secondary)]">{fmt(rec.timeOut)}</Td>
                          <Td numeric className="text-[var(--text-secondary)]">
                            {rec.hoursWorked ? `${rec.hoursWorked.toFixed(1)}h` : "—"}
                          </Td>
                          <Td numeric className="text-[var(--text-secondary)]">
                            {rec.otHours ? `${rec.otHours.toFixed(1)}h` : "—"}
                          </Td>
                          <Td>
                            {rec.otRateCode
                              ? <Badge variant="neutral">{rec.otRateCode.replace(/_/g, " ")}</Badge>
                              : <span className="text-[var(--text-tertiary)]">—</span>
                            }
                          </Td>
                          <Td>
                            <Badge
                              dot
                              variant={
                                status === "Present" ? "success"
                                : status === "In progress" ? "brand"
                                : status === "Late / Short" ? "warning"
                                : "neutral"
                              }
                            >
                              {status}
                            </Badge>
                          </Td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <Td colSpan={5} className="text-xs text-[var(--text-secondary)] font-medium">
                        Totals
                      </Td>
                      <Td numeric className="font-semibold">
                        {histRecords.reduce((s, r) => s + Math.min(r.hoursWorked, 8), 0).toFixed(1)}h
                      </Td>
                      <Td numeric className="font-semibold">
                        {histRecords.reduce((s, r) => s + (r.otHours ?? 0), 0).toFixed(1)}h
                      </Td>
                      <Td colSpan={2} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
