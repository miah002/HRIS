import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
import { OT_RATES } from "@/lib/ph-payroll";
import { getPHHoliday } from "@/lib/ph-holidays";
import { Clock, LogIn, LogOut, PlusCircle } from "lucide-react";
import { nowPH, toPhDate } from "@/lib/format";

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

function currentCutoff(now = nowPH()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (d >= 11 && d <= 25) return { start: new Date(y, m, 11), end: new Date(y, m, 25), label: `${now.toLocaleString("en-PH", { month: "long", timeZone: "Asia/Manila" })} 11–25` };
  if (d >= 26)             return { start: new Date(y, m, 26), end: new Date(y, m + 1, 10), label: `${now.toLocaleString("en-PH", { month: "long", timeZone: "Asia/Manila" })} 26–10` };
  return { start: new Date(y, m - 1, 26), end: new Date(y, m, 10), label: `${now.toLocaleString("en-PH", { month: "long", timeZone: "Asia/Manila" })} 26–10` };
}

function lastCutoff(now = nowPH()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (d >= 11 && d <= 25) return { start: new Date(y, m - 1, 26), end: new Date(y, m, 10) };
  if (d >= 26)            return { start: new Date(y, m, 11), end: new Date(y, m, 25) };
  return { start: new Date(y, m - 1, 11), end: new Date(y, m - 1, 25) };
}

function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function todayPH() {
  const ph = nowPH();
  return new Date(ph.getFullYear(), ph.getMonth(), ph.getDate());
}

/** Format local date as YYYY-MM-DD without UTC conversion */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Deduct 1h lunch break for shifts >= 5h (PH Labor Code standard) */
function applyLunchBreak(rawHours: number): number {
  return rawHours >= 5 ? rawHours - 1 : rawHours;
}

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" });
}

function computeNdHours(timeIn: Date, timeOut: Date): number {
  // ND window: 10 PM PHT to 6 AM PHT next day = UTC 14:00 to UTC 22:00
  const ndStart = new Date(timeIn); ndStart.setUTCHours(14, 0, 0, 0);
  const ndEnd   = new Date(timeIn); ndEnd.setUTCHours(22, 0, 0, 0);
  // If timeIn is after 22:00 UTC that day, shift ndStart/ndEnd to next UTC day
  if (timeIn.getUTCHours() >= 22) {
    ndStart.setUTCDate(ndStart.getUTCDate() + 1);
    ndEnd.setUTCDate(ndEnd.getUTCDate() + 1);
  }
  const overlapStart = Math.max(timeIn.getTime(), ndStart.getTime());
  const overlapEnd   = Math.min(timeOut.getTime(), ndEnd.getTime());
  return Math.round((Math.max(0, overlapEnd - overlapStart) / 3600000) * 100) / 100;
}

function buildFilterQs(period: string, employeeId: string, from: string, to: string) {
  const qs = new URLSearchParams({ tab: "history", period });
  if (employeeId) qs.set("employeeId", employeeId);
  if (period === "custom" && from) qs.set("from", from);
  if (period === "custom" && to)   qs.set("to", to);
  return qs.toString();
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
  const rawHours = Math.max(0, (now.getTime() - timeInDt.getTime()) / (1000 * 60 * 60));
  const hoursWorked = applyLunchBreak(rawHours);
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
  const rawHours = Math.max(0, (timeOutDt.getTime() - timeInDt.getTime()) / (1000 * 60 * 60));
  const hoursWorked = applyLunchBreak(rawHours);
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

async function bulkEntry(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const employeeId = String(formData.get("employeeId"));
  if (!employeeId) redirect("/attendance?tab=bulk");
  const weekStr    = String(formData.get("week"));

  for (let i = 0; i < 7; i++) {
    if (!formData.get(`day_${i}_checked`)) continue;
    const dateStr    = String(formData.get(`day_${i}_date`));
    const timeInStr  = String(formData.get(`day_${i}_timeIn`));
    const timeOutStr = String(formData.get(`day_${i}_timeOut`));
    const otRateCode = (formData.get(`day_${i}_otRateCode`) as string | null) || null;

    const date = new Date(dateStr + "T00:00:00");
    const [inH, inM]   = timeInStr.split(":").map(Number);
    const [outH, outM] = timeOutStr.split(":").map(Number);
    const timeInDt  = new Date(date); timeInDt.setHours(inH, inM, 0, 0);
    const timeOutDt = new Date(date); timeOutDt.setHours(outH, outM, 0, 0);

    const rawHours = Math.max(0, (timeOutDt.getTime() - timeInDt.getTime()) / 3600000);
    const hoursWorked = applyLunchBreak(rawHours);
    const otHours     = Math.max(0, hoursWorked - 8);
    const ndHours     = computeNdHours(timeInDt, timeOutDt);
    const isRestDay   = !!otRateCode?.includes("RD");
    const isHoliday   = !!(otRateCode?.startsWith("RH") || otRateCode?.startsWith("SH"));

    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId, date } },
      update: { timeIn: timeInDt, timeOut: timeOutDt, hoursWorked: Math.round(hoursWorked * 100) / 100, otHours: Math.round(otHours * 100) / 100, ndHours: Math.round(ndHours * 100) / 100, isRestDay, isHoliday, otRateCode },
      create: { employeeId, date, timeIn: timeInDt, timeOut: timeOutDt, hoursWorked: Math.round(hoursWorked * 100) / 100, otHours: Math.round(otHours * 100) / 100, ndHours: Math.round(ndHours * 100) / 100, isRestDay, isHoliday, otRateCode },
    });
  }
  redirect(`/attendance?tab=bulk&week=${weekStr}&bulkEmployeeId=${employeeId}&saved=1`);
}

async function editAttendance(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const id         = String(formData.get("id"));
  const timeInStr  = String(formData.get("timeIn"));
  const timeOutStr = String(formData.get("timeOut"));
  const otRateCode = (formData.get("otRateCode") as string | null) || null;
  const filterPeriod     = (formData.get("filterPeriod")     as string) || "current";
  const filterEmployeeId = (formData.get("filterEmployeeId") as string) || "";
  const filterFrom       = (formData.get("filterFrom")       as string) || "";
  const filterTo         = (formData.get("filterTo")         as string) || "";

  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) redirect(`/attendance?${buildFilterQs(filterPeriod, filterEmployeeId, filterFrom, filterTo)}`);

  const [inH, inM]   = timeInStr.split(":").map(Number);
  const [outH, outM] = timeOutStr.split(":").map(Number);
  const timeInDt  = new Date(existing.date); timeInDt.setHours(inH, inM, 0, 0);
  const timeOutDt = new Date(existing.date); timeOutDt.setHours(outH, outM, 0, 0);

  const rawHours = Math.max(0, (timeOutDt.getTime() - timeInDt.getTime()) / 3600000);
  const hoursWorked = applyLunchBreak(rawHours);
  const otHours     = Math.max(0, hoursWorked - 8);
  const ndHours     = computeNdHours(timeInDt, timeOutDt);

  await prisma.attendance.update({
    where: { id },
    data: {
      timeIn: timeInDt, timeOut: timeOutDt,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours:     Math.round(otHours     * 100) / 100,
      ndHours:     Math.round(ndHours     * 100) / 100,
      otRateCode,
    },
  });
  redirect(`/attendance?${buildFilterQs(filterPeriod, filterEmployeeId, filterFrom, filterTo)}`);
}

async function deleteAttendance(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const id               = String(formData.get("id"));
  const filterPeriod     = (formData.get("filterPeriod")     as string) || "current";
  const filterEmployeeId = (formData.get("filterEmployeeId") as string) || "";
  const filterFrom       = (formData.get("filterFrom")       as string) || "";
  const filterTo         = (formData.get("filterTo")         as string) || "";
  await prisma.attendance.delete({ where: { id } });
  redirect(`/attendance?${buildFilterQs(filterPeriod, filterEmployeeId, filterFrom, filterTo)}`);
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
  const editing = params.editing ?? "";

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

  // Bulk entry: resolve week to Monday
  const rawWeek    = params.week ?? toLocalDateStr(nowPH());
  const bulkMonday = mondayOf(rawWeek);
  const bulkWeekStr    = toLocalDateStr(bulkMonday);
  const bulkEmployeeId = params.bulkEmployeeId ?? "";
  const bulkSaved      = params.saved === "1";

  const bulkDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(bulkMonday);
    d.setDate(bulkMonday.getDate() + i);
    const dow     = d.getDay();
    const holiday = getPHHoliday(d);
    let autoCode: string | null = null;
    if      (holiday?.type === "RH") autoCode = "RH";
    else if (holiday?.type === "SH") autoCode = "SH";
    else if (dow === 0 || dow === 6) autoCode = "RD";
    return {
      date:           d,
      dateStr:        toLocalDateStr(d),
      dayName:        d.toLocaleDateString("en-PH", { weekday: "short" }),
      dateDisplay:    d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      autoCode,
      holidayName:    holiday?.name ?? null,
      defaultChecked: dow !== 0,
    };
  });

  const bulkWeekEnd = new Date(bulkMonday);
  bulkWeekEnd.setDate(bulkMonday.getDate() + 6);
  const bulkExisting = (tab === "bulk" && bulkEmployeeId)
    ? await prisma.attendance.findMany({
        where: { employeeId: bulkEmployeeId, date: { gte: bulkMonday, lte: bulkWeekEnd } },
      })
    : [];
  const bulkExistingMap = new Map(bulkExisting.map((r) => [toLocalDateStr(r.date), r]));

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
    const status = !rec ? "Absent" : !rec.timeIn ? "Absent" : !rec.timeOut ? "In progress"
      : (rec.isRestDay || rec.otRateCode?.startsWith("RD")) ? "Present"
      : rec.hoursWorked < 8 ? "Late / Short" : "Present";
    return { e, rec, status };
  });

  const presentCount = rows.filter((r) => r.status === "Present" || r.status === "In progress").length;
  const absentCount = rows.filter((r) => r.status === "Absent").length;
  const rdTodayCount = todayRecords.filter((r) => r.hoursWorked > 0 && (r.isRestDay || r.otRateCode?.includes("RD"))).length;
  const holTodayCount = todayRecords.filter((r) => r.hoursWorked > 0 && (r.isHoliday || r.otRateCode?.startsWith("RH") || r.otRateCode?.startsWith("SH"))).length;
  const todayLabel = today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Build filter query string for use in edit/delete links
  const filterQs = buildFilterQs(period, histEmployeeId, params.from ?? "", params.to ?? "");

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
          { label: "Bulk entry", value: "bulk" },
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
      {tab === "today" && (
      <>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">Working on RD</div>
            <div className={`text-2xl font-semibold mt-1 ${rdTodayCount > 0 ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"}`}>
              {rdTodayCount}
            </div>
            {rdTodayCount > 0 && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">×1.30 premium</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">Working on Holiday</div>
            <div className={`text-2xl font-semibold mt-1 ${holTodayCount > 0 ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"}`}>
              {holTodayCount}
            </div>
            {holTodayCount > 0 && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">×2.00+ premium</div>}
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
                          <SubmitButton size="sm">
                            <LogIn className="h-3 w-3" />Time in
                          </SubmitButton>
                        </form>
                      )}
                      {rec?.timeIn && !rec?.timeOut && (
                        <form action={timeOut}>
                          <input type="hidden" name="employeeId" value={e.id} />
                          <SubmitButton size="sm" variant="secondary">
                            <LogOut className="h-3 w-3" />Time out
                          </SubmitButton>
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
                defaultValue={toLocalDateStr(today)}
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
              <SubmitButton size="sm">Save attendance</SubmitButton>
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
                    id="history-period-select"
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
                    defaultValue={toLocalDateStr(histFrom)}
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">To</label>
                  <input
                    type="date" name="to"
                    defaultValue={toLocalDateStr(histTo)}
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

                <SubmitButton size="sm">View</SubmitButton>
              </form>
              <script dangerouslySetInnerHTML={{ __html: `(function(){var s=document.getElementById('history-period-select');if(s)s.addEventListener('change',function(){this.form.submit();});})();` }} />
            </CardContent>
          </Card>

          {/* RD/Holiday summary for period */}
          {histRecords.length > 0 && (() => {
            const rdIds = new Set(histRecords.filter(r => r.hoursWorked > 0 && (r.isRestDay || r.otRateCode?.includes("RD"))).map(r => r.employeeId));
            const holIds = new Set(histRecords.filter(r => r.hoursWorked > 0 && (r.isHoliday || r.otRateCode?.startsWith("RH") || r.otRateCode?.startsWith("SH"))).map(r => r.employeeId));
            const rdHrsHist = histRecords.filter(r => r.isRestDay || r.otRateCode?.includes("RD")).reduce((s, r) => s + r.hoursWorked, 0);
            const holHrsHist = histRecords.filter(r => r.isHoliday || r.otRateCode?.startsWith("RH") || r.otRateCode?.startsWith("SH")).reduce((s, r) => s + r.hoursWorked, 0);
            if (!rdIds.size && !holIds.size) return null;
            return (
              <div className="flex flex-wrap gap-4 px-1">
                {rdIds.size > 0 && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-subtle,_#fff8e1)] px-3 py-2 text-xs">
                    <span className="font-semibold text-[var(--warning)]">Rest Day work</span>
                    <span className="text-[var(--text-secondary)] ml-2">{rdIds.size} employee{rdIds.size > 1 ? "s" : ""} · {rdHrsHist.toFixed(1)}h · ×1.30 premium</span>
                  </div>
                )}
                {holIds.size > 0 && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-subtle,_#fff8e1)] px-3 py-2 text-xs">
                    <span className="font-semibold text-[var(--warning)]">Holiday work</span>
                    <span className="text-[var(--text-secondary)] ml-2">{holIds.size} employee{holIds.size > 1 ? "s" : ""} · {holHrsHist.toFixed(1)}h · ×2.00+ premium</span>
                  </div>
                )}
              </div>
            );
          })()}

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
                      {period === "current" && <Th></Th>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histRecords.map((rec) => {
                      const status =
                        !rec.timeIn ? "Absent"
                        : !rec.timeOut ? "In progress"
                        : (rec.isRestDay || rec.otRateCode?.startsWith("RD")) ? "Present"
                        : rec.hoursWorked < 8 ? "Late / Short"
                        : "Present";
                      return editing === rec.id && period === "current" ? (
                        <TableRow key={rec.id} className="bg-[var(--neutral-bg)]">
                          <Td colSpan={3} className="text-sm font-medium">
                            {rec.employee.lastName}, {rec.employee.firstName}
                            <span className="ml-2 text-xs text-[var(--text-tertiary)]">
                              {rec.date.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                            </span>
                          </Td>
                          <Td colSpan={7}>
                            <form action={editAttendance} className="flex flex-wrap gap-2 items-center">
                              <input type="hidden" name="id" value={rec.id} />
                              <input type="hidden" name="filterPeriod"     value={period} />
                              <input type="hidden" name="filterEmployeeId" value={histEmployeeId} />
                              <input type="hidden" name="filterFrom"       value={params.from ?? ""} />
                              <input type="hidden" name="filterTo"         value={params.to   ?? ""} />
                              <input
                                type="time" name="timeIn"
                                defaultValue={rec.timeIn ? `${String(toPhDate(rec.timeIn).getHours()).padStart(2,"0")}:${String(toPhDate(rec.timeIn).getMinutes()).padStart(2,"0")}` : "08:00"}
                                className="h-8 w-28 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                              />
                              <span className="text-[var(--text-tertiary)]">→</span>
                              <input
                                type="time" name="timeOut"
                                defaultValue={rec.timeOut ? `${String(toPhDate(rec.timeOut).getHours()).padStart(2,"0")}:${String(toPhDate(rec.timeOut).getMinutes()).padStart(2,"0")}` : "17:00"}
                                className="h-8 w-28 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                              />
                              <select
                                name="otRateCode" defaultValue={rec.otRateCode ?? ""}
                                className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-xs focus:outline-none focus:border-[var(--brand)]"
                              >
                                <option value="">— None —</option>
                                {["Regular OT", "Rest Day", "Special Holiday", "Regular Holiday", "Night Differential"].map((group) => (
                                  <optgroup key={group} label={group}>
                                    {OT_RATE_OPTIONS.filter((o) => o.group === group).map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              <SubmitButton size="sm">Save</SubmitButton>
                              <Link
                                href={`/attendance?${filterQs}`}
                                className="text-xs text-[var(--text-secondary)] hover:underline ml-1"
                              >
                                Cancel
                              </Link>
                            </form>
                          </Td>
                        </TableRow>
                      ) : (
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
                          {period === "current" && (
                            <Td>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/attendance?${filterQs}&editing=${rec.id}`}
                                  className="text-xs font-medium text-[var(--brand)] hover:underline"
                                >
                                  Edit
                                </Link>
                                <form action={deleteAttendance} className="inline">
                                  <input type="hidden" name="id"               value={rec.id} />
                                  <input type="hidden" name="filterPeriod"     value={period} />
                                  <input type="hidden" name="filterEmployeeId" value={histEmployeeId} />
                                  <input type="hidden" name="filterFrom"       value={params.from ?? ""} />
                                  <input type="hidden" name="filterTo"         value={params.to   ?? ""} />
                                  <SubmitButton className="text-xs font-medium text-[var(--error)] hover:underline">
                                    Delete
                                  </SubmitButton>
                                </form>
                              </div>
                            </Td>
                          )}
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
                      <Td colSpan={period === "current" ? 3 : 2} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* ── BULK ENTRY TAB ── */}
      {tab === "bulk" && (
        <div className="space-y-5">
          {bulkSaved && (
            <div className="rounded-[var(--radius-md)] bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] px-4 py-3 text-sm">
              ✓ Attendance saved.
            </div>
          )}

          {/* Week + employee selector (GET form) */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <form method="GET" className="flex flex-wrap gap-3 items-end">
                <input type="hidden" name="tab" value="bulk" />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Employee</label>
                  <select
                    name="bulkEmployeeId"
                    defaultValue={bulkEmployeeId}
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  >
                    <option value="">Select employee…</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Week of (any date)</label>
                  <input
                    type="date" name="week" defaultValue={bulkWeekStr}
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>
                <SubmitButton size="sm" variant="secondary">Load week</SubmitButton>
              </form>
            </CardContent>
          </Card>

          {/* Bulk entry form (POST) */}
          <form id="bulk-entry-form" action={bulkEntry}>
            <input type="hidden" name="employeeId" value={bulkEmployeeId} />
            <input type="hidden" name="week" value={bulkWeekStr} />
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Week of {bulkMonday.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                  {bulkEmployeeId && (() => { const e = employees.find((x) => x.id === bulkEmployeeId); return e ? ` · ${e.lastName}, ${e.firstName}` : ""; })()}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <Th className="w-10"></Th>
                      <Th>Day</Th>
                      <Th>Date</Th>
                      <Th>Time in</Th>
                      <Th>Time out</Th>
                      <Th>Rate code</Th>
                      <Th className="text-right">Reg hrs</Th>
                      <Th className="text-right">OT hrs</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkDays.map((day, i) => {
                      const existing   = bulkExistingMap.get(day.dateStr);
                      const defaultIn  = existing?.timeIn
                        ? `${String(toPhDate(existing.timeIn).getHours()).padStart(2, "0")}:${String(toPhDate(existing.timeIn).getMinutes()).padStart(2, "0")}`
                        : "08:00";
                      const defaultOut = existing?.timeOut
                        ? `${String(toPhDate(existing.timeOut).getHours()).padStart(2, "0")}:${String(toPhDate(existing.timeOut).getMinutes()).padStart(2, "0")}`
                        : (day.autoCode === "RD" ? "12:00" : "17:00");
                      const defaultCode = existing?.otRateCode ?? day.autoCode ?? "";
                      const regHrs      = existing ? Math.min(existing.hoursWorked, 8) : null;
                      const otHrs       = existing?.otHours ?? null;
                      const isSun       = day.date.getDay() === 0;
                      return (
                        <TableRow key={day.dateStr} className={isSun ? "opacity-60" : ""}>
                          <Td>
                            <input
                              type="checkbox"
                              name={`day_${i}_checked`}
                              value="1"
                              defaultChecked={existing != null ? true : day.defaultChecked}
                              className="rounded"
                            />
                            <input type="hidden" name={`day_${i}_date`}        value={day.dateStr} />
                            <input type="hidden" name={`day_${i}_hasExisting`} value={existing ? "1" : "0"} />
                          </Td>
                          <Td className="text-sm font-medium">{day.dayName}</Td>
                          <Td className="text-[var(--text-secondary)]">
                            {day.dateDisplay}
                            {day.holidayName && (
                              <span className="ml-1.5 text-xs text-[var(--warning)]">{day.holidayName}</span>
                            )}
                          </Td>
                          <Td>
                            <input
                              type="time" name={`day_${i}_timeIn`} defaultValue={defaultIn}
                              className="h-8 w-28 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                            />
                          </Td>
                          <Td>
                            <input
                              type="time" name={`day_${i}_timeOut`} defaultValue={defaultOut}
                              className="h-8 w-28 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                            />
                          </Td>
                          <Td>
                            <select
                              name={`day_${i}_otRateCode`} defaultValue={defaultCode}
                              className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-xs focus:outline-none focus:border-[var(--brand)]"
                            >
                              <option value="">— None —</option>
                              {["Regular OT", "Rest Day", "Special Holiday", "Regular Holiday", "Night Differential"].map((group) => (
                                <optgroup key={group} label={group}>
                                  {OT_RATE_OPTIONS.filter((o) => o.group === group).map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </Td>
                          <Td numeric className="text-xs text-[var(--text-secondary)]">
                            {regHrs != null ? `${regHrs.toFixed(1)}h` : "—"}
                          </Td>
                          <Td numeric className="text-xs text-[var(--text-secondary)]">
                            {otHrs != null && otHrs > 0 ? `${otHrs.toFixed(1)}h` : "—"}
                          </Td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="flex justify-end mt-3">
              <SubmitButton size="sm">Save checked rows</SubmitButton>
            </div>
          </form>

          <script dangerouslySetInnerHTML={{ __html: `
(function() {
  var form = document.getElementById('bulk-entry-form');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    var overrideCount = 0;
    for (var i = 0; i < 7; i++) {
      var chk = form.querySelector('[name="day_' + i + '_checked"]');
      var has = form.querySelector('[name="day_' + i + '_hasExisting"]');
      if (chk && chk.checked && has && has.value === '1') overrideCount++;
    }
    if (overrideCount > 0) {
      var msg = overrideCount === 1
        ? '1 day already has attendance data. Override it?'
        : overrideCount + ' days already have attendance data. Override them?';
      if (!window.confirm(msg)) e.preventDefault();
    }
  });
})();
          ` }} />
        </div>
      )}
    </div>
  );
}
