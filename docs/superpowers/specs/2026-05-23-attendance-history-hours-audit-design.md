# Design: Attendance History, Hours Preview, Payslip Audit Trail

**Date:** 2026-05-23  
**Status:** Approved  
**Approach:** Option A — tabs + inline panels

---

## 1. Problem

Payroll managers have no way to:
- Review past attendance records (attendance page shows today only)
- Verify hours before running payroll (no pre-run summary)
- Audit which attendance rows fed a specific payslip (no drill-down on payslip)

---

## 2. Solution Overview

Three targeted additions, all read-only, no schema changes:

| Feature | Location | What it adds |
|---|---|---|
| Attendance History tab | `/attendance` | Date-range + employee filter, full attendance log |
| Hours Preview card | `/payroll` | Per-employee hours summary before running payroll |
| Attendance Detail section | `/payroll/[id]` | Raw attendance rows that fed the payslip |

---

## 3. Feature 1: Attendance History Tab

### URL Pattern

History state driven by `searchParams`:
- `?tab=history` — activates history tab
- `?period=current` | `last` | `custom` — period filter (default: `current`)
- `?from=YYYY-MM-DD&to=YYYY-MM-DD` — used when `period=custom`
- `?employeeId=<id>` — filter to one employee (default: all)

Today tab: `?tab=today` (default when no tab param)

### UI Layout

```
[ Today ]  [ History ]          ← tab switcher

History tab:
┌─────────────────────────────────────────────┐
│ Period: [Current cutoff ▼]  Employee: [All ▼]  [View] │
└─────────────────────────────────────────────┘

┌──────────┬────────┬─────┬──────────┬──────────┬──────┬──────┬──────────┬──────────┐
│ Employee │ Date   │ Day │ Time In  │ Time Out │ Hrs  │ OT   │ Rate     │ Status   │
├──────────┼────────┼─────┼──────────┼──────────┼──────┼──────┼──────────┼──────────┤
│ Castillo │ May 15 │ Thu │ 08:00 AM │ 06:30 PM │ 10.5 │ 2.5  │ R OT     │ Present  │
│ ...      │        │     │          │          │      │      │          │          │
├──────────┴────────┴─────┴──────────┴──────────┼──────┼──────┼──────────┴──────────┤
│ Totals                                         │ Xh   │ Yh   │                     │
└────────────────────────────────────────────────┴──────┴──────┴─────────────────────┘
```

### Period Options

| Label | Date range |
|---|---|
| Current cutoff | Same logic as `currentCutoff()` in payroll page |
| Last cutoff | Previous semi-monthly period |
| Custom range | `from` / `to` date inputs appear |

### Data Query

```ts
prisma.attendance.findMany({
  where: {
    employee: { companyId },
    date: { gte: from, lte: to },
    ...(employeeId ? { employeeId } : {}),
  },
  include: { employee: true },
  orderBy: [{ employee: { lastName: "asc" } }, { date: "asc" }],
})
```

### Status Derivation

- No record → "Absent"
- `timeIn` but no `timeOut` → "In progress"
- `hoursWorked < 8` → "Late / Short"
- `hoursWorked >= 8` → "Present"

### Totals Footer

- When all employees: one footer row with company-wide totals (reg hrs, OT hrs)
- When single employee: footer shows that employee's totals + "X days worked"

### Empty State

"No attendance records found for this period." with a link to log manual entry.

---

## 4. Feature 2: Payroll Hours Preview Card

### Location

`/payroll` — rendered above the "Run payroll" button, always visible.

### Title

**"Attendance summary — [cutoff label]"** (e.g. "Attendance summary — May 16–31")

### Table

| Employee | Days | Reg Hrs | OT Hrs | Rate Codes | Est. OT Pay |
|---|---|---|---|---|---|
| Castillo, Louie | 10 | 80.0 | 4.5 | `R OT` `RH` | ₱2,154.00 |
| Emnase, John Andrew | 0 | 0 | 0 | — | ₱0 — *fixed half-month* |

### Est. OT Pay Computation

Per employee, iterate attendance rows for the cutoff:
```ts
const hr = hourlyRate(employee.basicMonthlyRate);
let estOtPay = 0;
for (const row of rows) {
  const code = row.otRateCode ?? "R_OT";
  estOtPay += (row.otHours ?? 0) * hr * (OT_RATES[code] ?? 1.25);
}
```

### Rate Codes Column

Distinct `otRateCode` values present in that employee's attendance rows for the period, rendered as `<Badge variant="neutral">`. Null codes shown as `—`.

### No-attendance Row

Dim text: "No attendance — fixed half-month (₱X)" where X = `employee.basicMonthlyRate / 2`.

### Empty State (no employees)

Hidden — impossible if there are employees.

---

## 5. Feature 3: Payslip Attendance Detail

### Location

`/payroll/[id]` — new card after the earnings/deductions breakdown, before the release button.

### Title

**"Attendance records this period"**

### Table

| Date | Day | Time In | Time Out | Reg Hrs | OT Hrs | Rate Code | OT Pay |
|---|---|---|---|---|---|---|---|
| May 1 | Fri | 08:00 AM | 06:30 PM | 8.0 | 2.5 | R OT | ₱358.45 |

### OT Pay per Row

```ts
const hr = hourlyRate(employee.basicMonthlyRate);
const code = row.otRateCode ?? "R_OT";
const otPay = round2((row.otHours ?? 0) * hr * (OT_RATES[code] ?? 1.25));
```

### Footer

"Total: X days · Y reg hrs · Z OT hrs · ₱total OT pay"

### No-attendance State

Dim card: "No attendance recorded for this period. Basic pay was computed as fixed half-month (₱X)."

### Print Behavior

Section wrapper has Tailwind class `print:hidden` — hidden in payslip printout. Existing `@media print` block in `globals.css` hides `.print\:hidden` elements.

---

## 6. Files Changed

| File | Change |
|---|---|
| `src/app/(app)/attendance/page.tsx` | Add tab switcher, History tab with filter form + results table |
| `src/app/(app)/payroll/page.tsx` | Add attendance summary card above Run Payroll button |
| `src/app/(app)/payroll/[id]/page.tsx` | Add attendance detail card (hidden on print) |

---

## 7. Out of Scope

- Editing attendance from history view (read-only)
- Pagination (all records for period shown; periods are max 15–16 days so row count is bounded)
- Export to CSV from history view
- Night differential auto-detection from time range
