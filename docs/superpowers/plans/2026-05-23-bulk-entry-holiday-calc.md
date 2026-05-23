# Bulk Entry, PH Holidays, Premium Pay Fix, Editable History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PH holiday utility, fix payroll premium pay loop, add bulk attendance entry tab, make current-cutoff history editable, and seed test attendance data.

**Architecture:** Five sequential changes. Tasks 1 and 2 are independent of each other. Tasks 3 and 4 both modify `attendance/page.tsx` — execute sequentially. Task 5 modifies `seed.ts` independently.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/SQLite, Tailwind CSS, Server Actions, searchParams-driven GET forms. No unit test runner installed — verify with `npx tsc --noEmit` and manual browser checks.

---

### Task 1: PH Holiday Calendar (`src/lib/ph-holidays.ts`)

**Files:**
- Create: `src/lib/ph-holidays.ts`

- [ ] **Step 1: Create `src/lib/ph-holidays.ts`**

```ts
export type PHHolidayType = "RH" | "SH";

export interface PHHoliday {
  date: string; // "YYYY-MM-DD"
  name: string;
  type: PHHolidayType;
}

const PH_HOLIDAYS: PHHoliday[] = [
  // 2025 Regular Holidays
  { date: "2025-01-01", name: "New Year's Day",                     type: "RH" },
  { date: "2025-04-09", name: "Araw ng Kagitingan",                 type: "RH" },
  { date: "2025-04-17", name: "Maundy Thursday",                    type: "RH" },
  { date: "2025-04-18", name: "Good Friday",                        type: "RH" },
  { date: "2025-05-01", name: "Labor Day",                          type: "RH" },
  { date: "2025-06-12", name: "Independence Day",                   type: "RH" },
  { date: "2025-08-25", name: "National Heroes Day",                type: "RH" },
  { date: "2025-11-30", name: "Bonifacio Day",                      type: "RH" },
  { date: "2025-12-25", name: "Christmas Day",                      type: "RH" },
  { date: "2025-12-30", name: "Rizal Day",                          type: "RH" },
  // 2025 Special Non-Working Holidays
  { date: "2025-01-29", name: "Chinese New Year",                   type: "SH" },
  { date: "2025-02-25", name: "EDSA People Power Revolution",       type: "SH" },
  { date: "2025-04-19", name: "Black Saturday",                     type: "SH" },
  { date: "2025-08-21", name: "Ninoy Aquino Day",                   type: "SH" },
  { date: "2025-11-01", name: "All Saints' Day",                    type: "SH" },
  { date: "2025-11-02", name: "All Souls' Day",                     type: "SH" },
  { date: "2025-12-08", name: "Feast of the Immaculate Conception", type: "SH" },
  { date: "2025-12-24", name: "Christmas Eve",                      type: "SH" },
  { date: "2025-12-31", name: "New Year's Eve",                     type: "SH" },
  // 2026 Regular Holidays
  { date: "2026-01-01", name: "New Year's Day",                     type: "RH" },
  { date: "2026-04-02", name: "Maundy Thursday",                    type: "RH" },
  { date: "2026-04-03", name: "Good Friday",                        type: "RH" },
  { date: "2026-04-09", name: "Araw ng Kagitingan",                 type: "RH" },
  { date: "2026-05-01", name: "Labor Day",                          type: "RH" },
  { date: "2026-06-12", name: "Independence Day",                   type: "RH" },
  { date: "2026-08-31", name: "National Heroes Day",                type: "RH" },
  { date: "2026-11-30", name: "Bonifacio Day",                      type: "RH" },
  { date: "2026-12-25", name: "Christmas Day",                      type: "RH" },
  { date: "2026-12-30", name: "Rizal Day",                          type: "RH" },
  // 2026 Special Non-Working Holidays
  { date: "2026-01-28", name: "Chinese New Year",                   type: "SH" },
  { date: "2026-02-25", name: "EDSA People Power Revolution",       type: "SH" },
  { date: "2026-04-04", name: "Black Saturday",                     type: "SH" },
  { date: "2026-08-21", name: "Ninoy Aquino Day",                   type: "SH" },
  { date: "2026-11-01", name: "All Saints' Day",                    type: "SH" },
  { date: "2026-11-02", name: "All Souls' Day",                     type: "SH" },
  { date: "2026-12-08", name: "Feast of the Immaculate Conception", type: "SH" },
  { date: "2026-12-24", name: "Christmas Eve",                      type: "SH" },
  { date: "2026-12-31", name: "New Year's Eve",                     type: "SH" },
];

const holidayMap = new Map(PH_HOLIDAYS.map((h) => [h.date, h]));

export function getPHHoliday(date: Date): PHHoliday | null {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return holidayMap.get(`${y}-${m}-${d}`) ?? null;
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ph-holidays.ts
git commit -m "feat(attendance): PH holiday calendar 2025-2026"
```

---

### Task 2: Fix runPayroll Premium Pay Loop

**Files:**
- Modify: `src/app/(app)/payroll/page.tsx:40-49`

The bug: `if (!hours) continue` skips rest-day/holiday rows where `otHours === 0`, missing the regular-hours premium (30% for RD/SH, 100% for RH) that is additional on top of basicPay. Also, ndHours are never summed.

- [ ] **Step 1: Replace lines 40–49 in `src/app/(app)/payroll/page.tsx`**

Find exactly:
```ts
    for (const row of attendance) {
      const hours = row.otHours ?? 0;
      if (!hours) continue;
      const code = row.otRateCode ?? "R_OT";
      const mult = OT_RATES[code] ?? 1.25;
      const pay  = Math.round(hours * hr * mult * 100) / 100;
      if (code.startsWith("ND"))       nightDiffPayIn += pay;
      else if (code.startsWith("RH"))  holidayPayIn   += pay;
      else                             overtimePayIn  += pay;
    }
```

Replace with:
```ts
    const REG_PREMIUM: Record<string, number> = {
      RD: 0.30,    RD_OT: 0.30,
      SH: 0.30,    SH_OT: 0.30,  SH_RD: 0.50,   SH_RD_OT: 0.50,
      RH: 1.00,    RH_OT: 1.00,  RH_RD: 1.60,   RH_RD_OT: 1.60,
    };
    for (const row of attendance) {
      const code   = row.otRateCode;
      const regHrs = Math.min(row.hoursWorked, 8);
      const otHrs  = row.otHours ?? 0;
      const ndHrs  = row.ndHours ?? 0;
      if (!code) {
        if (otHrs > 0) overtimePayIn += Math.round(otHrs * hr * 1.25 * 100) / 100;
      } else {
        const baseCode = code.replace(/_OT$/, "");
        const regPrem  = (REG_PREMIUM[code] ?? 0) * regHrs * hr;
        const otPay    = otHrs > 0 ? otHrs * hr * (OT_RATES[code] ?? 1.25) : 0;
        const total    = Math.round((regPrem + otPay) * 100) / 100;
        if (baseCode.startsWith("RH"))      holidayPayIn   += total;
        else if (baseCode.startsWith("ND")) nightDiffPayIn += total;
        else                                overtimePayIn  += total;
      }
      if (ndHrs > 0) nightDiffPayIn += Math.round(ndHrs * hr * 0.10 * 100) / 100;
    }
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/payroll/page.tsx
git commit -m "fix(payroll): compute regular-hours premium for rest days and holidays"
```

---

### Task 3: Bulk Entry Tab

**Files:**
- Modify: `src/app/(app)/attendance/page.tsx`

Adds `getPHHoliday` import, `mondayOf` helper, `computeNdHours` helper, `bulkEntry` server action, bulk tab data loading in component, third tab in switcher, and Bulk entry JSX. Also fixes the Today tab condition from `tab !== "history"` to `tab === "today"`.

- [ ] **Step 1: Add `getPHHoliday` import after line 10**

After `import { OT_RATES } from "@/lib/ph-payroll";`, insert:
```ts
import { getPHHoliday } from "@/lib/ph-holidays";
```

- [ ] **Step 2: Add `mondayOf` helper after the `lastCutoff` function (after line 43)**

```ts
function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
```

- [ ] **Step 3: Add `computeNdHours` helper after the `fmt` function (after line 53)**

```ts
function computeNdHours(timeIn: Date, timeOut: Date): number {
  const ndStart = new Date(timeIn); ndStart.setHours(22, 0, 0, 0);
  const ndEnd   = new Date(timeIn); ndEnd.setDate(ndEnd.getDate() + 1); ndEnd.setHours(6, 0, 0, 0);
  const overlapStart = Math.max(timeIn.getTime(), ndStart.getTime());
  const overlapEnd   = Math.min(timeOut.getTime(), ndEnd.getTime());
  return Math.round((Math.max(0, overlapEnd - overlapStart) / 3600000) * 100) / 100;
}
```

- [ ] **Step 4: Add `bulkEntry` server action after the `logManual` action (after line 142)**

```ts
async function bulkEntry(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const employeeId = String(formData.get("employeeId"));
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

    const hoursWorked = Math.max(0, (timeOutDt.getTime() - timeInDt.getTime()) / 3600000);
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
```

- [ ] **Step 5: Add bulk tab data loading in the component, after the `histRecords` block and before `const employees` (before line 189)**

```ts
  // Bulk entry: resolve week to Monday
  const rawWeek    = params.week ?? new Date().toISOString().split("T")[0];
  const bulkMonday = mondayOf(rawWeek);
  const bulkWeekStr    = bulkMonday.toISOString().split("T")[0];
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
      dateStr:        d.toISOString().split("T")[0],
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
  const bulkExistingMap = new Map(bulkExisting.map((r) => [r.date.toISOString().split("T")[0], r]));
```

- [ ] **Step 6: Add "Bulk entry" to tab switcher**

Find:
```ts
        {[
          { label: "Today", value: "today" },
          { label: "History", value: "history" },
        ].map((t) => (
```
Replace with:
```ts
        {[
          { label: "Today", value: "today" },
          { label: "History", value: "history" },
          { label: "Bulk entry", value: "bulk" },
        ].map((t) => (
```

- [ ] **Step 7: Fix Today tab condition**

Find: `{tab !== "history" && (`
Replace with: `{tab === "today" && (`

- [ ] **Step 8: Add Bulk entry tab JSX — insert before the final closing `</div>` of the page (before the last `  );`)**

```tsx
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
                <Button type="submit" size="sm" variant="secondary">Load week</Button>
              </form>
            </CardContent>
          </Card>

          {/* Bulk entry form (POST) */}
          <form action={bulkEntry}>
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
                        ? `${String(existing.timeIn.getHours()).padStart(2, "0")}:${String(existing.timeIn.getMinutes()).padStart(2, "0")}`
                        : "08:00";
                      const defaultOut = existing?.timeOut
                        ? `${String(existing.timeOut.getHours()).padStart(2, "0")}:${String(existing.timeOut.getMinutes()).padStart(2, "0")}`
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
                            <input type="hidden" name={`day_${i}_date`} value={day.dateStr} />
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
              <Button type="submit" size="sm">Save checked rows</Button>
            </div>
          </form>
        </div>
      )}
```

- [ ] **Step 9: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/app/(app)/attendance/page.tsx
git commit -m "feat(attendance): bulk entry tab with PH holiday auto-detection"
```

---

### Task 4: Editable Current Cutoff History

**Files:**
- Modify: `src/app/(app)/attendance/page.tsx`

Adds `editAttendance` and `deleteAttendance` server actions. History rows show Edit/Delete when `period === "current"`. When `editing=<id>` param is set, that row renders as an inline form.

- [ ] **Step 1: Add `editing` to searchParams destructure**

After line 155 (`const tab = params.tab ?? "today";`), add:
```ts
  const editing = params.editing ?? "";
```

- [ ] **Step 2: Add `editAttendance` and `deleteAttendance` server actions after `bulkEntry`**

```ts
async function editAttendance(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const id         = String(formData.get("id"));
  const timeInStr  = String(formData.get("timeIn"));
  const timeOutStr = String(formData.get("timeOut"));
  const otRateCode = (formData.get("otRateCode") as string | null) || null;

  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) redirect("/attendance?tab=history&period=current");

  const [inH, inM]   = timeInStr.split(":").map(Number);
  const [outH, outM] = timeOutStr.split(":").map(Number);
  const timeInDt  = new Date(existing.date); timeInDt.setHours(inH, inM, 0, 0);
  const timeOutDt = new Date(existing.date); timeOutDt.setHours(outH, outM, 0, 0);

  const hoursWorked = Math.max(0, (timeOutDt.getTime() - timeInDt.getTime()) / 3600000);
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
  redirect("/attendance?tab=history&period=current");
}

async function deleteAttendance(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const id = String(formData.get("id"));
  await prisma.attendance.delete({ where: { id } });
  redirect("/attendance?tab=history&period=current");
}
```

- [ ] **Step 3: Add Actions column header to history table**

In the history table `<TableHeader>`, find:
```tsx
                      <Th>Status</Th>
```
Replace with:
```tsx
                      <Th>Status</Th>
                      {period === "current" && <Th></Th>}
```

- [ ] **Step 4: Replace history row rendering to support inline edit**

The current `histRecords.map` block returns one `<TableRow>` per record. Replace the entire `return (` block (the `<TableRow key={rec.id}>...</TableRow>`) inside the map with:

```tsx
                        {editing === rec.id && period === "current" ? (
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
                                <input
                                  type="time" name="timeIn"
                                  defaultValue={rec.timeIn ? `${String(rec.timeIn.getHours()).padStart(2,"0")}:${String(rec.timeIn.getMinutes()).padStart(2,"0")}` : "08:00"}
                                  className="h-8 w-28 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                                />
                                <span className="text-[var(--text-tertiary)]">→</span>
                                <input
                                  type="time" name="timeOut"
                                  defaultValue={rec.timeOut ? `${String(rec.timeOut.getHours()).padStart(2,"0")}:${String(rec.timeOut.getMinutes()).padStart(2,"0")}` : "17:00"}
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
                                <Button type="submit" size="sm">Save</Button>
                                <Link
                                  href="/attendance?tab=history&period=current"
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
                              <Badge dot variant={status === "Present" ? "success" : status === "In progress" ? "brand" : status === "Late / Short" ? "warning" : "neutral"}>
                                {status}
                              </Badge>
                            </Td>
                            {period === "current" && (
                              <Td>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/attendance?tab=history&period=current&editing=${rec.id}`}
                                    className="text-xs font-medium text-[var(--brand)] hover:underline"
                                  >
                                    Edit
                                  </Link>
                                  <form action={deleteAttendance} className="inline">
                                    <input type="hidden" name="id" value={rec.id} />
                                    <button type="submit" className="text-xs font-medium text-[var(--error)] hover:underline">
                                      Delete
                                    </button>
                                  </form>
                                </div>
                              </Td>
                            )}
                          </TableRow>
                        )}
```

- [ ] **Step 5: Update TableFooter last `<Td>` colSpan for Actions column**

Find:
```tsx
                      <Td colSpan={2} />
```
Replace with:
```tsx
                      <Td colSpan={period === "current" ? 3 : 2} />
```

- [ ] **Step 6: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/attendance/page.tsx
git commit -m "feat(attendance): editable current-cutoff records in History tab"
```

---

### Task 5: Attendance Test Data (`prisma/seed.ts`)

**Files:**
- Modify: `prisma/seed.ts`

Adds attendance records for May 1–15 (previous cutoff) and May 16–31 (current cutoff). Uses `new Date(year, month, day)` (local time) consistent with how the rest of the app creates dates.

- [ ] **Step 1: Add attendance seed after the leave requests loop (after line 205, before `console.log`)**

```ts
  // --- Attendance test data ---
  function attData(date: Date, inH: number, inM: number, outH: number, outM: number, rateCode: string | null) {
    const timeIn  = new Date(date); timeIn.setHours(inH, inM, 0, 0);
    const timeOut = new Date(date); timeOut.setHours(outH, outM, 0, 0);
    const hoursWorked = (timeOut.getTime() - timeIn.getTime()) / 3600000;
    const otHours     = Math.max(0, hoursWorked - 8);
    return {
      timeIn, timeOut,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours:     Math.round(otHours     * 100) / 100,
      ndHours:     0,
      isRestDay:   !!rateCode?.includes("RD"),
      isHoliday:   !!(rateCode?.startsWith("RH") || rateCode?.startsWith("SH")),
      otRateCode:  rateCode,
    };
  }

  // Previous cutoff: May 1–15, 2026 — weekdays
  const prevWeekdays = [
    new Date(2026, 4, 4),  new Date(2026, 4, 5),  new Date(2026, 4, 6),
    new Date(2026, 4, 7),  new Date(2026, 4, 8),
    new Date(2026, 4, 11), new Date(2026, 4, 12), new Date(2026, 4, 13),
    new Date(2026, 4, 14), new Date(2026, 4, 15),
  ];
  for (const { id: empId } of created) {
    for (const date of prevWeekdays) {
      const d = attData(date, 8, 0, 17, 0, null);
      await prisma.attendance.upsert({
        where:  { employeeId_date: { employeeId: empId, date } },
        update: d, create: { employeeId: empId, date, ...d },
      });
    }
  }

  // Employees 0,1,2 (Emnase, Castillo, Veloso): Saturday May 10 rest day
  for (const { id: empId } of [created[0], created[1], created[2]]) {
    const date = new Date(2026, 4, 10);
    const d = attData(date, 8, 0, 17, 0, "RD");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Employees 3,4 (Domingo, Espanola): Thursday May 7 with 2h OT (overrides the regular day above)
  for (const { id: empId } of [created[3], created[4]]) {
    const date = new Date(2026, 4, 7);
    const d = attData(date, 8, 0, 19, 0, "R_OT");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Current cutoff: May 16–31, 2026 — weekdays
  const currWeekdays = [
    new Date(2026, 4, 18), new Date(2026, 4, 19), new Date(2026, 4, 20),
    new Date(2026, 4, 21), new Date(2026, 4, 22),
    new Date(2026, 4, 25), new Date(2026, 4, 26), new Date(2026, 4, 27),
    new Date(2026, 4, 28), new Date(2026, 4, 29),
  ];
  for (const { id: empId } of created) {
    for (const date of currWeekdays) {
      const d = attData(date, 8, 0, 17, 0, null);
      await prisma.attendance.upsert({
        where:  { employeeId_date: { employeeId: empId, date } },
        update: d, create: { employeeId: empId, date, ...d },
      });
    }
  }

  // Employees 0,1 (Emnase, Castillo): Wednesday May 20 with 1h OT (overrides regular day)
  for (const { id: empId } of [created[0], created[1]]) {
    const date = new Date(2026, 4, 20);
    const d = attData(date, 8, 0, 18, 0, "R_OT");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Employees 2,3 (Veloso, Domingo): Saturday May 23, 4h rest day (no OT)
  for (const { id: empId } of [created[2], created[3]]) {
    const date = new Date(2026, 4, 23);
    const d = attData(date, 8, 0, 13, 0, "RD");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Employee 4 (Espanola): Saturday May 23, 9h → RD_OT (1h OT)
  {
    const { id: empId } = created[4];
    const date = new Date(2026, 4, 23);
    const d = attData(date, 8, 0, 17, 0, "RD_OT");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run seed**

Run: `npx prisma db seed`
Expected output ends with:
```
Seeded company "MMTSI" with 8 employees.
```
No errors.

- [ ] **Step 4: Verify data in app**

Navigate to `/attendance?tab=history&period=current`. Expect ~80 rows (8 employees × 10 weekdays) plus Saturday entries for employees 2–4. Navigate to `/payroll`, run payroll — employees 0 and 1 should have overtime pay for 1h at R_OT rate.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): attendance test data for May 2026 previous and current cutoffs"
```
