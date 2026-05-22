# Attendance History, Hours Preview & Payslip Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add attendance history tab with date/employee filters, a pre-run hours summary card on the payroll page, and an attendance detail section on each payslip — giving payroll managers full visibility into hours before and after payroll runs.

**Architecture:** All three features are read-only additions to existing server components. No schema changes. The attendance page gains `searchParams`-driven tabs and a GET filter form. The payroll page gains an additional DB query for attendance summary. The payslip page gains an attendance rows query scoped to the payroll period.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM + SQLite, Server Components, Tailwind CSS

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/app/(app)/attendance/page.tsx` | Modify | Add tab switcher, `searchParams`, cutoff helpers, history query, history filter form + results table |
| `src/app/(app)/payroll/page.tsx` | Modify | Add attendance summary card (employees + attendance queries, per-employee computation) |
| `src/app/(app)/payroll/[id]/page.tsx` | Modify | Add attendance detail card (print:hidden), fix stale 313-day formula references |

---

## Task 1: Attendance History Tab

**Files:**
- Modify: `src/app/(app)/attendance/page.tsx`

- [ ] **Step 1: Add Link import and cutoff helpers**

At the top of `src/app/(app)/attendance/page.tsx`, change the `next/navigation` import and add `Link`:

```ts
import Link from "next/link";
import { redirect } from "next/navigation";
```

After the `OT_RATE_OPTIONS` constant and before `todayPH()`, add these two helpers:

```ts
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
```

- [ ] **Step 2: Add searchParams to the page component and history data query**

Change the `AttendancePage` component signature and add history logic at the top of the component (before the today query):

```ts
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
```

Keep the rest of the existing today logic (`employees`, `today`, `todayRecords`, `recordMap`, `rows`, `presentCount`, `absentCount`, `todayLabel`) unchanged, just below the new code.

- [ ] **Step 3: Add tab switcher above the summary strip**

In the JSX return, replace the opening `<div className="space-y-6">` with:

```tsx
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
```

Remove the existing `<div>` header block that had the Clock icon (it's now included above). Wrap the rest of the existing today content in `{tab !== "history" && (...)}`.

- [ ] **Step 4: Add History tab content after the Today content**

After the closing of the today content block, add:

```tsx
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
```

- [ ] **Step 5: Verify the page builds**

```bash
cd "c:\Users\Admin\OneDrive\Documents\Claude\HRIS\HRIS" && npx tsc --noEmit 2>&1
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/attendance/page.tsx
git commit -m "feat(attendance): history tab with date/employee filter"
```

---

## Task 2: Payroll Hours Preview Card

**Files:**
- Modify: `src/app/(app)/payroll/page.tsx`

- [ ] **Step 1: Add attendance and employee queries to PayrollPage**

In the `PayrollPage` component, after `const cutoff = currentCutoff();` and before the `runs` query, add:

```ts
// Fetch data for the hours preview card
const previewEmployees = await prisma.employee.findMany({
  where: { archived: false },
  orderBy: { lastName: "asc" },
});

const previewAttendance = await prisma.attendance.findMany({
  where: { date: { gte: cutoff.start, lte: cutoff.end } },
});
```

- [ ] **Step 2: Compute per-employee summary**

After the two queries above, add:

```ts
// Group attendance rows by employeeId for the preview card
const attByEmployee = new Map<string, typeof previewAttendance>();
for (const row of previewAttendance) {
  const list = attByEmployee.get(row.employeeId) ?? [];
  list.push(row);
  attByEmployee.set(row.employeeId, list);
}

const previewRows = previewEmployees.map((emp) => {
  const rows = attByEmployee.get(emp.id) ?? [];
  const days = rows.filter((r) => r.hoursWorked > 0).length;
  const regHrs = rows.reduce((s, r) => s + Math.min(r.hoursWorked, 8), 0);
  const hr = hourlyRate(emp.basicMonthlyRate);
  let estOtPay = 0;
  const codeSet = new Set<string>();
  for (const row of rows) {
    const hours = row.otHours ?? 0;
    if (!hours) continue;
    const code = row.otRateCode ?? "R_OT";
    codeSet.add(code);
    estOtPay += Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100;
  }
  const otHrs = rows.reduce((s, r) => s + (r.otHours ?? 0), 0);
  return { emp, days, regHrs, otHrs, estOtPay, codes: [...codeSet] };
});
```

- [ ] **Step 3: Add the Hours Preview card to the JSX**

In the JSX return, after the `{ran && ...}` success banner and before the summary KPI grid, add:

```tsx
{/* Hours preview card */}
<Card>
  <CardHeader>
    <CardTitle className="text-sm flex items-center gap-2">
      <Clock className="h-4 w-4 text-[var(--brand)]" />
      Attendance summary — {cutoff.label}
    </CardTitle>
  </CardHeader>
  <CardContent className="p-0">
    <Table>
      <TableHeader>
        <TableRow>
          <Th>Employee</Th>
          <Th className="text-right">Days</Th>
          <Th className="text-right">Reg hrs</Th>
          <Th className="text-right">OT hrs</Th>
          <Th>Rate codes</Th>
          <Th className="text-right">Est. OT pay</Th>
        </TableRow>
      </TableHeader>
      <TableBody>
        {previewRows.map(({ emp, days, regHrs, otHrs, estOtPay, codes }) => (
          <TableRow key={emp.id}>
            <Td>
              <span className="text-sm font-medium">{emp.lastName}, {emp.firstName}</span>
            </Td>
            <Td numeric className="text-[var(--text-secondary)]">
              {days > 0 ? days : <span className="text-[var(--text-tertiary)]">—</span>}
            </Td>
            <Td numeric className="text-[var(--text-secondary)]">
              {regHrs > 0 ? `${regHrs.toFixed(1)}h` : <span className="text-[var(--text-tertiary)]">—</span>}
            </Td>
            <Td numeric className="text-[var(--text-secondary)]">
              {otHrs > 0 ? `${otHrs.toFixed(1)}h` : <span className="text-[var(--text-tertiary)]">—</span>}
            </Td>
            <Td>
              {codes.length > 0
                ? <div className="flex flex-wrap gap-1">
                    {codes.map((c) => (
                      <Badge key={c} variant="neutral" className="text-[10px]">{c.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                : <span className="text-[var(--text-tertiary)] text-xs">—</span>
              }
            </Td>
            <Td numeric>
              {days === 0
                ? <span className="text-xs text-[var(--text-tertiary)]">fixed ½-month</span>
                : estOtPay > 0
                  ? <span className="font-medium text-[var(--brand)]">{php(estOtPay)}</span>
                  : <span className="text-[var(--text-tertiary)]">—</span>
              }
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

- [ ] **Step 4: Add missing imports**

The payroll page needs `Clock` from lucide-react. Add it to the existing lucide import:

```ts
import { PlayCircle, Wallet, FileText, Clock } from "lucide-react";
```

Also ensure `TableFooter` is imported (it should already be from the table component import line).

- [ ] **Step 5: Verify build**

```bash
cd "c:\Users\Admin\OneDrive\Documents\Claude\HRIS\HRIS" && npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/payroll/page.tsx
git commit -m "feat(payroll): attendance hours preview card before run"
```

---

## Task 3: Payslip Attendance Detail + Formula Fix

**Files:**
- Modify: `src/app/(app)/payroll/[id]/page.tsx`

- [ ] **Step 1: Add OT_RATES and hourlyRate imports**

In `src/app/(app)/payroll/[id]/page.tsx`, change the `ph-payroll` import:

```ts
import { computeSemiMonthlyPayroll, OT_RATES, hourlyRate } from "@/lib/ph-payroll";
```

- [ ] **Step 2: Add attendance query to PayslipPage**

In the `PayslipPage` component, after the `payroll` query (after `if (!payroll) notFound();`), add:

```ts
const attendanceRows = await prisma.attendance.findMany({
  where: {
    employeeId: payroll.employeeId,
    date: { gte: payroll.periodStart, lte: payroll.periodEnd },
  },
  orderBy: { date: "asc" },
});

const hr = hourlyRate(e.basicMonthlyRate);
const attTotalRegHrs = attendanceRows.reduce((s, r) => s + Math.min(r.hoursWorked, 8), 0);
const attTotalOtHrs  = attendanceRows.reduce((s, r) => s + (r.otHours ?? 0), 0);
const attTotalDays   = attendanceRows.filter((r) => r.hoursWorked > 0).length;
const attTotalOtPay  = attendanceRows.reduce((s, r) => {
  const hours = r.otHours ?? 0;
  if (!hours) return s;
  const code = r.otRateCode ?? "R_OT";
  return s + Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100;
}, 0);
```

Note: `e` is already defined above as `const e = payroll.employee;`.

- [ ] **Step 3: Fix stale 313-day formula in earnings label**

On the earnings array (around line 184), find this line:

```ts
? `Basic pay (${payroll.daysWorked}d × ${php((e.basicMonthlyRate * 12) / 313)})`
```

Replace with:

```ts
? `Basic pay (${payroll.daysWorked}d × ${php(e.basicMonthlyRate / 21.75)})`
```

- [ ] **Step 4: Fix stale formula in payslip header OT display**

Around line 242, find:

```ts
{payroll.daysWorked > 0 && (
  <p className="text-xs opacity-75 mt-0.5">
    Days: {payroll.daysWorked} · OT: {payroll.overtimePay > 0 ? (payroll.overtimePay / ((e.basicMonthlyRate * 12 / 313 / 8) * 1.25)).toFixed(1) + "h" : "0h"}
  </p>
)}
```

Replace with:

```ts
{payroll.daysWorked > 0 && (
  <p className="text-xs opacity-75 mt-0.5">
    Days: {payroll.daysWorked} · OT hrs: {attTotalOtHrs > 0 ? `${attTotalOtHrs.toFixed(1)}h` : "0h"}
  </p>
)}
```

- [ ] **Step 5: Fix stale formula in admin tools footnote**

Around line 387, find:

```ts
Daily rate: {php((e.basicMonthlyRate * 12) / 313)} · Hourly: {php((e.basicMonthlyRate * 12) / 313 / 8)} · OT rate (×1.25): {php((e.basicMonthlyRate * 12) / 313 / 8 * 1.25)}
```

Replace with:

```ts
Daily rate: {php(e.basicMonthlyRate / 21.75)} · Hourly: {php(e.basicMonthlyRate / 21.75 / 8)} · OT rate (×1.25): {php(e.basicMonthlyRate / 21.75 / 8 * 1.25)}
```

- [ ] **Step 6: Add attendance detail card to the JSX**

After the closing `</div>` of the payslip card (after the `</div>` that closes `id="payslip"`) and before the `{isAdmin && ...}` admin tools block, add:

```tsx
{/* Attendance detail — hidden on print */}
<div className="print:hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
  <div className="px-5 py-3.5 border-b border-[var(--border)]">
    <div className="text-sm font-semibold">Attendance records this period</div>
    <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
      {phDate(payroll.periodStart)} – {phDate(payroll.periodEnd)}
    </div>
  </div>

  {attendanceRows.length === 0 ? (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-[var(--text-secondary)]">No attendance recorded for this period.</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">
        Basic pay computed as fixed half-month ({php(e.basicMonthlyRate / 2)}).
      </p>
    </div>
  ) : (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <Th>Date</Th>
            <Th>Day</Th>
            <Th>Time in</Th>
            <Th>Time out</Th>
            <Th className="text-right">Reg hrs</Th>
            <Th className="text-right">OT hrs</Th>
            <Th>Rate code</Th>
            <Th className="text-right">OT pay</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendanceRows.map((row) => {
            const hours = row.otHours ?? 0;
            const code  = row.otRateCode ?? "R_OT";
            const rowOtPay = hours > 0
              ? Math.round(hours * hr * (OT_RATES[code] ?? 1.25) * 100) / 100
              : 0;
            return (
              <TableRow key={row.id}>
                <Td className="text-[var(--text-secondary)]">
                  {row.date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </Td>
                <Td className="text-[var(--text-secondary)]">
                  {row.date.toLocaleDateString("en-PH", { weekday: "short" })}
                </Td>
                <Td className="tabular text-[var(--text-secondary)]">
                  {row.timeIn ? row.timeIn.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                </Td>
                <Td className="tabular text-[var(--text-secondary)]">
                  {row.timeOut ? row.timeOut.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                </Td>
                <Td numeric className="text-[var(--text-secondary)]">
                  {Math.min(row.hoursWorked, 8).toFixed(1)}h
                </Td>
                <Td numeric className="text-[var(--text-secondary)]">
                  {hours > 0 ? `${hours.toFixed(1)}h` : "—"}
                </Td>
                <Td>
                  {row.otRateCode
                    ? <Badge variant="neutral" className="text-[10px]">{row.otRateCode.replace(/_/g, " ")}</Badge>
                    : <span className="text-[var(--text-tertiary)]">—</span>
                  }
                </Td>
                <Td numeric>
                  {rowOtPay > 0
                    ? <span className="font-medium text-[var(--brand)]">{php(rowOtPay)}</span>
                    : <span className="text-[var(--text-tertiary)]">—</span>
                  }
                </Td>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <Td colSpan={4} className="text-xs font-medium text-[var(--text-secondary)]">
              Total · {attTotalDays} day{attTotalDays !== 1 ? "s" : ""}
            </Td>
            <Td numeric className="font-semibold">{attTotalRegHrs.toFixed(1)}h</Td>
            <Td numeric className="font-semibold">{attTotalOtHrs > 0 ? `${attTotalOtHrs.toFixed(1)}h` : "—"}</Td>
            <Td />
            <Td numeric className="font-semibold text-[var(--brand)]">
              {attTotalOtPay > 0 ? php(attTotalOtPay) : "—"}
            </Td>
          </TableRow>
        </TableFooter>
      </Table>
    </>
  )}
</div>
```

- [ ] **Step 7: Add Table imports to payslip page**

The payslip page doesn't currently import table components. Add to imports:

```ts
import { Table, TableHeader, TableBody, TableRow, Th, Td, TableFooter } from "@/components/ui/table";
```

- [ ] **Step 8: Verify build**

```bash
cd "c:\Users\Admin\OneDrive\Documents\Claude\HRIS\HRIS" && npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/payroll/\[id\]/page.tsx
git commit -m "feat(payslip): attendance detail section + fix 313-day formula"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Attendance History tab with Today/History tab switcher (Task 1)
- ✅ Period filter: Current cutoff / Last cutoff / Custom range (Task 1 Step 2, Step 4)
- ✅ Employee filter: All / individual (Task 1 Step 4)
- ✅ History table: Employee, Date, Day, Time In/Out, Hrs, OT, Rate Code, Status (Task 1 Step 4)
- ✅ Totals footer on history table (Task 1 Step 4)
- ✅ Empty state with link to log entry (Task 1 Step 4)
- ✅ Hours Preview card on payroll page (Task 2)
- ✅ Per-employee: Days, Reg Hrs, OT Hrs, Rate Codes badges, Est. OT Pay (Task 2 Steps 2–3)
- ✅ "fixed ½-month" note for employees with no attendance (Task 2 Step 3)
- ✅ Payslip Attendance Detail section (Task 3 Step 6)
- ✅ Per-row: Date, Day, Time In/Out, Reg Hrs, OT Hrs, Rate Code, OT Pay (Task 3 Step 6)
- ✅ Footer totals on payslip detail (Task 3 Step 6)
- ✅ No-attendance empty state on payslip (Task 3 Step 6)
- ✅ print:hidden on payslip detail (Task 3 Step 6 — `className="print:hidden"`)
- ✅ Formula fix: 313-day → 21.75 in payslip earnings label, header, admin footnote (Task 3 Steps 3–5)

**Type consistency check:**
- `histRecords` typed as `Attendance & { employee: Employee }[]` from Prisma include — consistent with table render ✅
- `previewRows` computed inline, `emp` is `Employee`, `codes` is `string[]` — consistent with JSX ✅
- `attendanceRows` from Prisma, `hr` from `hourlyRate(e.basicMonthlyRate)` — consistent with row computation ✅
- `attTotalRegHrs`, `attTotalOtHrs`, `attTotalDays`, `attTotalOtPay` computed before JSX, used in footer ✅
- `TableFooter` imported in Task 3 Step 7 — used in Step 6 ✅

**Placeholder scan:** No TBDs, vague steps, or incomplete code blocks found.
