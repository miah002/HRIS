# Design: Bulk Entry, PH Holiday Calendar, Premium Pay Calculation, Editable History

**Date:** 2026-05-23  
**Status:** Approved

---

## 1. Problem

- No way to enter attendance for multiple days at once — manual entry is one row at a time
- Rest day (Sat/Sun) and holiday premiums are not computed for regular hours (only OT hours had a rate code applied)
- No PH holiday awareness in attendance entry
- History tab is read-only; payroll managers cannot correct current-period records
- No realistic test data to verify calculations

---

## 2. Scope

Five changes, one spec:

| # | Change | Files |
|---|---|---|
| 1 | `src/lib/ph-holidays.ts` — new | PH holiday static list 2025–2026 |
| 2 | `src/app/(app)/payroll/page.tsx` | Fix `runPayroll` loop: compute regular-hours premium for all premium days |
| 3 | `src/app/(app)/attendance/page.tsx` | Bulk entry tab (third tab) |
| 4 | `src/app/(app)/attendance/page.tsx` | Editable current-cutoff rows in History tab |
| 5 | `prisma/seed.ts` | Test data: previous + current cutoff attendance |

---

## 3. Calculation Model

`basicPay = monthlyRate / 2` always. All premium pay is **additional** on top.

| Day type | Regular hrs (≤8) additional | OT hrs (>8) |
|---|---|---|
| Regular weekday | 0 (in basicPay) | `otHrs × hr × 1.25` |
| Rest day (Sat/Sun) | `regHrs × hr × 0.30` | `otHrs × hr × 1.69` |
| Special holiday | `regHrs × hr × 0.30` | `otHrs × hr × 1.69` |
| Regular holiday | `regHrs × hr × 1.00` | `otHrs × hr × 2.60` |
| Night diff (10PM–6AM) | `ndHrs × hr × 0.10` | ND_OT combined rate |

Where `hr = hourlyRate(monthlyRate)` = `monthlyRate / 21.75 / 8`.

**OT rate derivation from `otRateCode`:**

```
baseCode = otRateCode with "_OT" suffix stripped (e.g. "RD_OT" → "RD")
regPremiumRate:
  RD / SH / SH_RD → 0.30
  RH / RH_RD      → 1.00
  ND*              → 0.10
  null / R_OT      → 0.00 (no regular-hours premium)

otRate = OT_RATES[otRateCode]   // full multiplier for OT hours
```

The current `runPayroll` loop skips rows where `otHours === 0`. Fix: process ALL rows with non-null `otRateCode`, even those with `otHours === 0` (rest day / holiday with exactly 8 hours).

---

## 4. PH Holiday Calendar (`src/lib/ph-holidays.ts`)

Static list for 2025–2026. Source: Official Gazette of the Philippines.

```ts
export type PHHolidayType = "RH" | "SH";

export interface PHHoliday {
  date: string;   // "YYYY-MM-DD"
  name: string;
  type: PHHolidayType;
}

export function getPHHoliday(date: Date): PHHoliday | null
```

**2025 Regular Holidays (RH):**
- 2025-01-01 New Year's Day
- 2025-04-09 Araw ng Kagitingan
- 2025-04-17 Maundy Thursday
- 2025-04-18 Good Friday
- 2025-05-01 Labor Day
- 2025-06-12 Independence Day
- 2025-08-25 National Heroes Day (last Mon of Aug)
- 2025-11-30 Bonifacio Day
- 2025-12-25 Christmas Day
- 2025-12-30 Rizal Day

**2025 Special Non-Working Holidays (SH):**
- 2025-01-29 Chinese New Year
- 2025-02-25 EDSA People Power Revolution Anniversary
- 2025-04-19 Black Saturday
- 2025-08-21 Ninoy Aquino Day
- 2025-11-01 All Saints' Day
- 2025-11-02 All Souls' Day (special)
- 2025-12-08 Feast of the Immaculate Conception
- 2025-12-24 Christmas Eve
- 2025-12-31 New Year's Eve

**2026 Regular Holidays (RH):**
- 2026-01-01 New Year's Day
- 2026-04-02 Maundy Thursday
- 2026-04-03 Good Friday
- 2026-04-09 Araw ng Kagitingan
- 2026-05-01 Labor Day
- 2026-06-12 Independence Day
- 2026-08-31 National Heroes Day (last Mon of Aug)
- 2026-11-30 Bonifacio Day
- 2026-12-25 Christmas Day
- 2026-12-30 Rizal Day

**2026 Special Non-Working Holidays (SH):**
- 2026-01-28 Chinese New Year
- 2026-02-25 EDSA People Power Revolution Anniversary
- 2026-04-04 Black Saturday
- 2026-08-21 Ninoy Aquino Day
- 2026-11-01 All Saints' Day
- 2026-11-02 All Souls' Day
- 2026-12-08 Feast of the Immaculate Conception
- 2026-12-24 Christmas Eve
- 2026-12-31 New Year's Eve

---

## 5. Feature: Bulk Entry Tab

### Location

Third tab on `/attendance`: `[ Today ] [ History ] [ Bulk entry ]`

URL: `?tab=bulk`

### Layout

```
Employee: [Castillo, Louie ▼]   Week of: [YYYY-MM-DD]   [Load week]

 ✓  Mon  May 18  08:00 → 17:00  [— None —   ▼]   8.0h reg  0.0h OT  0.0h ND
 ✓  Tue  May 19  08:00 → 17:00  [— None —   ▼]
 ✓  Wed  May 20  08:00 → 17:00  [— None —   ▼]
 ✓  Thu  May 21  08:00 → 17:00  [— None —   ▼]
 ✓  Fri  May 22  08:00 → 17:00  [— None —   ▼]
 ✓  Sat  May 23  08:00 → 12:00  [RD ✦ auto  ▼]   4.0h reg  0.0h OT
 □  Sun  May 24  08:00 → 17:00  [RD ✦ auto  ▼]

                                              [Save checked rows]
```

### Logic

**Week selection:**
- `?tab=bulk&week=YYYY-MM-DD` (any date in the week → resolved to Mon of that week)
- "Load week" is a GET form submit, not a POST
- Default: current week

**Day-type auto-detection** (applied when week is loaded, overridable per row):
1. Saturday or Sunday → `otRateCode = "RD"`, `isRestDay = true`
2. Matches `getPHHoliday(date)`:
   - type `RH` → `otRateCode = "RH"`, `isHoliday = true`
   - type `SH` → `otRateCode = "SH"`, `isHoliday = true`
3. Otherwise → `otRateCode = null`

**On submit (server action `bulkEntry`):**
For each checked row:
1. Parse `timeIn`, `timeOut`
2. Compute `hoursWorked = (timeOut - timeIn) / 3600000`
3. Compute `otHours = max(0, hoursWorked - 8)`
4. Compute `ndHours`: overlap of [timeIn, timeOut] with [22:00, 06:00] of the same shift
5. Upsert into `attendance` by `employeeId + date`

**Night diff (ndHours) computation:**
```ts
function ndHours(timeIn: Date, timeOut: Date): number {
  // Count hours in [22:00, 06:00+1day] within the shift
  const shiftMs = timeOut.getTime() - timeIn.getTime();
  // Iterate over each ND window that overlaps the shift and sum overlap
  // ND window: 22:00 on date(timeIn) to 06:00 on date(timeIn)+1
  const ndStart = new Date(timeIn); ndStart.setHours(22, 0, 0, 0);
  const ndEnd   = new Date(timeIn); ndEnd.setDate(ndEnd.getDate() + 1); ndEnd.setHours(6, 0, 0, 0);
  const overlapStart = Math.max(timeIn.getTime(), ndStart.getTime());
  const overlapEnd   = Math.min(timeOut.getTime(), ndEnd.getTime());
  const overlap = Math.max(0, overlapEnd - overlapStart);
  return Math.round((overlap / 3600000) * 100) / 100;
}
```

**Sunday:** Unchecked by default. Row still visible with RD auto-set — user can check it if they worked.

**Existing records:** Upsert (overwrite) with the new values.

**Rate code dropdown on each row:** Same grouped `<select>` as manual entry (all 17 codes + "None"). Pre-selected from auto-detection but overridable.

---

## 6. Feature: Editable Current Cutoff in History

### Rules

- `period === "current"`: rows show **Edit** and **Delete** buttons
- `period === "last"` or `"custom"`: read-only (no buttons)

### Edit flow (no JS)

URL: `?tab=history&period=current&editing=<attendanceId>`

When `editing` param is set, the matching row is replaced with an inline edit form pre-filled with current values (timeIn, timeOut, otRateCode). Saving submits a POST server action `editAttendance`.

### Delete flow

A `<form action={deleteAttendance}>` with hidden `id`. No confirmation required (small internal HRIS).

### Server actions

```ts
async function editAttendance(formData: FormData) {
  "use server";
  // Re-compute hoursWorked, otHours, ndHours from new timeIn/timeOut
  // upsert by id
}

async function deleteAttendance(formData: FormData) {
  "use server";
  // prisma.attendance.delete({ where: { id } })
}
```

---

## 7. Feature: Payroll Engine Fix

### Current bug

`runPayroll` in `payroll/page.tsx`:
```ts
const hours = row.otHours ?? 0;
if (!hours) continue;   // ← SKIPS rest days with exactly 8h (no OT)
```

### Fix

Process all rows with a non-null `otRateCode`:

```ts
for (const row of attendance) {
  const code = row.otRateCode;
  if (!code) {
    // Regular weekday — only OT matters
    if ((row.otHours ?? 0) > 0) {
      overtimePayIn += Math.round((row.otHours ?? 0) * hr * 1.25 * 100) / 100;
    }
    continue;
  }

  const regHrs  = Math.min(row.hoursWorked, 8);
  const otHrs   = row.otHours ?? 0;
  const ndHrs   = row.ndHours ?? 0;
  const baseCode = code.replace(/_OT$/, "");

  // Regular-hours premium (above the 1.0× already in basicPay)
  const regPremiumRate: Record<string, number> = {
    RD: 0.30, RD_OT: 0.30,
    SH: 0.30, SH_OT: 0.30, SH_RD: 0.50, SH_RD_OT: 0.50,
    RH: 1.00, RH_OT: 1.00, RH_RD: 1.60, RH_RD_OT: 1.60,
  };
  const regPrem = (regPremiumRate[code] ?? 0) * regHrs * hr;

  // OT pay — full multiplier
  const otPay = otHrs > 0 ? otHrs * hr * (OT_RATES[code] ?? 1.25) : 0;

  // Night diff premium
  const ndPay = ndHrs > 0 ? ndHrs * hr * 0.10 : 0;

  // Route to buckets
  if (baseCode.startsWith("RH")) {
    holidayPayIn   += Math.round((regPrem + otPay) * 100) / 100;
  } else if (baseCode.startsWith("ND")) {
    nightDiffPayIn += Math.round((regPrem + otPay) * 100) / 100;
  } else {
    overtimePayIn  += Math.round((regPrem + otPay) * 100) / 100;
  }
  nightDiffPayIn += Math.round(ndPay * 100) / 100;
}
```

---

## 8. Test Data (seed.ts)

Add attendance for all 8 employees for:

**Previous cutoff: May 1–15, 2026 (Thu–Wed)**
- All employees: Mon–Fri (May 4, 5, 6, 7, 8, 11, 12, 13, 14, 15)
- Time: 08:00–17:00 (8h, no OT), `otRateCode = null`
- 3 employees: one Saturday (May 10) 08:00–17:00, `otRateCode = "RD"` (rest day premium)
- 2 employees: Wednesday May 7 = 08:00–19:00 (2h OT), `otRateCode = "R_OT"`

**Current cutoff: May 16–31, 2026 (Sat–Sun)**
- All employees: Mon–Fri (May 18, 19, 20, 21, 22, 25, 26, 27, 28, 29)
- Time: 08:00–17:00, `otRateCode = null`
- 2 employees: one day 08:00–18:00 (1h OT), `otRateCode = "R_OT"`
- 2 employees: Saturday May 23, 08:00–13:00 (4h RD, no OT), `otRateCode = "RD"`
- 1 employee: Saturday May 23, 08:00–17:00 (8h RD + 1h OT → hoursWorked=9), `otRateCode = "RD_OT"`, `otHours = 1`
- May 25 is not a 2026 holiday (regular Monday)

---

## 9. Files Changed

| File | Change |
|---|---|
| `src/lib/ph-holidays.ts` | New — PH holiday calendar 2025–2026 |
| `src/app/(app)/payroll/page.tsx` | Fix `runPayroll` loop |
| `src/app/(app)/attendance/page.tsx` | Add Bulk entry tab + editable current-cutoff history |
| `prisma/seed.ts` | Add attendance test data |

No schema changes required. `ndHours`, `isRestDay`, `isHoliday`, `otRateCode` already exist.

---

## 10. Out of Scope

- Paginated history (periods are max 16 days, row count bounded)
- CSV export
- Night differential when combined with rest day or holiday (ND_RH, ND_SH) — auto-detection deferred; users can manually override rate code
- Proclamation-based special working holidays
- Leave integration with attendance
