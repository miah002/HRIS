# Design: Real Employees + Full PH OT Rate Table

**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Option A — lean delta

---

## 1. Problem

Current seed has 15 random demo employees and a single OT multiplier (1.25×). User requires:
- Replace with 8 specific real employees (MMTSI company)
- Full 17-code PH Labor Code OT rate table applied in attendance and payroll
- Daily rate formula: `monthly / 21.75` (5-day week standard), not the current 313-day formula

---

## 2. Employees

All 8 employees belong to company `demo-co` ("Kape at Pandesal Co." renamed optionally — company stays as-is for now). All get portal login at `<firstname>.<lastname>@mmtsi.ph / demo1234`.

| Employee # | First | Middle | Last | Position | Dept | Monthly Rate |
|---|---|---|---|---|---|---|
| MMTSI2021-004 | John Andrew | Maglinte | Emnase | Admin Staff - Sto. Tomas | Admin | ₱20,000 |
| MMTSI2019-002 | Louie | Padawan | Castillo | Accounting Team Leader | Finance | ₱38,000 |
| MMTSI2019-003 | Angela Luz | Collantes | Veloso | Senior Accountant | Finance | ₱32,000 |
| MMTSI2022-006 | Ella Queenly | Atienza | Domingo | Admin Staff - Bauan | Admin | ₱20,000 |
| MMTSI2023-010 | Ailyn | Castillo | Espanola | Admin Staff | Admin | ₱18,000 |
| MMTSI2023-011 | Jay Lloyd | Josol | Sale | Admin Staff - Sto. Tomas | Admin | ₱18,000 |
| MMTSI2024-012 | Reyniel | Maglinte | Emnase | Admin Staff - Part-Time | Admin | ₱12,000 |
| MMTSI2025-013 | Jane | Balba | Ocampo | Accounting Staff | Finance | ₱22,000 |

Seed wipes all existing employees, payroll, attendance, leave, loans, documents before inserting these 8.

---

## 3. Schema Change

Add one nullable field to `Attendance` model in `prisma/schema.prisma`:

```prisma
model Attendance {
  ...
  otRateCode  String?   // null = regular day; one of 17 codes below
  ...
}
```

Run `npx prisma db push` — SQLite adds nullable column, no data loss.

---

## 4. OT Rate Table (`ph-payroll.ts`)

Replace `OT_MULTIPLIERS` with `OT_RATES` map (all multipliers applied to hourly rate × OT hours):

| Code | Description | Multiplier |
|---|---|---|
| R_OT | Regular OT | 1.25 |
| RD | Rest Day | 1.30 |
| RD_OT | Rest Day OT | 1.69 |
| SH | Special Holiday | 1.30 |
| SH_OT | Special Holiday OT | 1.69 |
| SH_RD | Special Holiday Rest Day | 1.50 |
| SH_RD_OT | Special Holiday Rest Day OT | 1.95 |
| RH | Regular Holiday | 2.00 |
| RH_OT | Regular Holiday OT | 2.60 |
| RH_RD | Regular Holiday Rest Day | 2.60 |
| RH_RD_OT | Regular Holiday Rest Day OT | 3.38 |
| ND | Night Differential | 1.10 |
| ND_OT | Night Differential OT | 1.38 |
| ND_SH | Night Differential on Special Holiday | 1.43 |
| ND_SH_OT | Night Differential on Special Holiday OT | 1.86 |
| ND_RH | Night Differential on Regular Holiday | 2.20 |
| ND_RH_OT | Night Differential on Regular Holiday OT | 2.86 |

**Daily rate formula change:**
```ts
// Before (313-day/6-day week):
const dailyRate = (monthlyRate * 12) / 313;
// After (21.75-day/5-day week):
const dailyRate = monthlyRate / 21.75;
const hrRate = dailyRate / 8;
```

Export `OT_RATES` map; keep `OT_MULTIPLIERS` as deprecated alias pointing to same values for any existing imports.

---

## 5. Attendance Page

**Manual entry form** — add `Rate Code` select after Time Out field:

```
[ Employee ] [ Date ] [ Time In ] [ Time Out ] [ Rate Code ▼ ] [ Flags ] [ Save ]
```

Options grouped:
- `— None (regular day) —`
- Regular OT: `R OT (×1.25)`
- Rest Day: `RD (×1.30)`, `RD OT (×1.69)`
- Special Holiday: `SH (×1.30)`, `SH OT (×1.69)`, `SH RD (×1.50)`, `SH RD OT (×1.95)`
- Regular Holiday: `RH (×2.00)`, `RH OT (×2.60)`, `RH RD (×2.60)`, `RH RD OT (×3.38)`
- Night Diff: `ND (×1.10)`, `ND OT (×1.38)`, `ND SH (×1.43)`, `ND SH OT (×1.86)`, `ND RH (×2.20)`, `ND RH OT (×2.86)`

**Attendance table** — add `Rate` column: shows code badge when set, `—` otherwise.

**Auto clock-in/out** — no `otRateCode` set (stays `null`). OT hours auto-computed as `max(0, hoursWorked - 8)` at clock-out, unchanged.

---

## 6. Payroll Computation

`computeSemiMonthlyPayroll` receives `otRateCode?: string` in `PayrollInput`.

OT pay routing:
- `ND*` codes → `nightDiffPay`
- `RH*` codes → `holidayPay`
- All others (R_OT, RD*, SH*) → `overtimePay`

Fallback: `otRateCode = null` with `otHours > 0` → use `R_OT` (1.25×). No regression on auto clock-out rows.

Payroll run aggregates attendance rows in period: sums regular hours for `basicPay`, iterates each row for OT/premium pay using its own `otRateCode`.

---

## 7. Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `otRateCode String?` to Attendance |
| `prisma/seed.ts` | Replace 15 random employees with 8 real ones; all get login |
| `src/lib/ph-payroll.ts` | New `OT_RATES` map, fix daily rate formula, update `computeSemiMonthlyPayroll` |
| `src/app/(app)/attendance/page.tsx` | Rate Code dropdown in manual form, Rate column in table |
| `src/app/(app)/payroll/page.tsx` | Pass `otRateCode` when aggregating attendance for payroll run |

---

## 8. Out of Scope

- Company name change (stays "Kape at Pandesal Co.")
- Payslip OT line-item split by rate code (single OT total stays)
- Night differential auto-detection from time range
- PH public holiday calendar integration
