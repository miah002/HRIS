import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { OT_MULTIPLIERS } from "@/lib/ph-payroll";
import { Clock, LogIn, LogOut, PlusCircle } from "lucide-react";

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
  const otherDeductions = formData.get("isHoliday") ? 1 : 0;

  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: {
      timeIn: timeInDt, timeOut: timeOutDt,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours: Math.round(otHours * 100) / 100,
      isRestDay: formData.get("isRestDay") === "on",
      isHoliday: formData.get("isHoliday") === "on",
    },
    create: {
      employeeId, date,
      timeIn: timeInDt, timeOut: timeOutDt,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours: Math.round(otHours * 100) / 100,
      ndHours: 0,
      isRestDay: formData.get("isRestDay") === "on",
      isHoliday: formData.get("isHoliday") === "on",
    },
  });
  redirect("/attendance");
}

export default async function AttendancePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });

  const employees = await prisma.employee.findMany({
    where: { companyId: user?.companyId ?? "", archived: false },
    orderBy: { firstName: "asc" },
  });

  const today = todayPH();
  const todayRecords = await prisma.attendance.findMany({
    where: {
      date: today,
      employee: { companyId: user?.companyId ?? "" },
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
          <form action={logManual} className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
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
            <div className="sm:col-span-3 lg:col-span-6 flex justify-end">
              <Button type="submit" size="sm">Save attendance</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-2xs text-[var(--text-tertiary)]">
        OT computed automatically: hours beyond 8 = regular OT at ×{OT_MULTIPLIERS.regular} (Labor Code Art. 87).
        Night differential (+{OT_MULTIPLIERS.ndPremium * 100}%, Art. 86) and rest-day/holiday premiums apply at payroll run.
      </p>
    </div>
  );
}
