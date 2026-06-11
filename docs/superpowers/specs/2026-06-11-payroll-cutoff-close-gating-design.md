# Payroll Cutoff Close Gating — Design

**Date:** 2026-06-11
**Status:** Approved
**Author:** Jeremiah Ulan + Claude

## Problem

The active payroll cutoff is derived purely from today's date by a `currentCutoff()`
function that is duplicated in four files (payroll, attendance, ot-approval, dashboard).
On the 11th of each month the date math flips the "current cutoff" from the `26–10`
period to the `11–25` period automatically.

This abandons a cutoff that is still being processed. Concretely: on 2026-06-11 the
payroll page jumped to `11–25` (Jun 11–25) even though finance was still running the
`26–10` cutoff (May 26 – Jun 10). There is no concept of a cutoff being "closed", so
nothing stops the auto-advance.

**Requirement:** Payroll must stay on the oldest un-closed cutoff until that cutoff is
explicitly closed. It must not advance just because the calendar date moved.

## Decisions (locked)

1. **Close model** — explicit. A new `PayrollPeriod` record carries `status` `OPEN | CLOSED`.
   The payroll page always shows the oldest `OPEN` period, ignoring today's date. Advancing
   to the next cutoff requires clicking **Close cutoff**.
2. **Pin scope** — Payroll **and** OT-approval follow the oldest `OPEN` cutoff (OT approval
   gates payroll, so they move together). Attendance stays on the real calendar date so staff
   keep clocking in for the new period. Dashboard shows the open cutoff.
3. **Close gate** — Close is allowed only when no payslip in the cutoff is still `DRAFT`
   (everyone released). A cutoff with zero payroll rows may be closed to skip it.

## Data Model

New model, mirroring `OTApproval`'s period-keyed shape:

```prisma
model PayrollPeriod {
  id          String    @id @default(cuid())
  companyId   String
  company     Company   @relation(fields: [companyId], references: [id])
  periodStart DateTime
  periodEnd   DateTime
  label       String    // "26–10" | "11–25"
  status      String    @default("OPEN") // OPEN | CLOSED
  closedBy    String?
  closedAt    DateTime?
  createdAt   DateTime  @default(now())
  @@unique([companyId, periodStart, periodEnd])
}
```

Add the back-relation `payrollPeriods PayrollPeriod[]` to `Company`.

**Invariant:** the active cutoff = the oldest `OPEN` period for the company. In normal flow
there is exactly one `OPEN` period at a time.

## New module: `src/lib/cutoff.ts`

Consolidates the four duplicated `currentCutoff()` copies into one canonical source.

| Export | Kind | Behaviour |
|--------|------|-----------|
| `cutoffForDate(now = nowPH())` | pure | Existing date math. Day 11–25 → `11–25`; day ≥ 26 → `26–10` (this month → next 10th); day 1–10 → `26–10` (last month 26 → this month 10). Returns `{ start, end, label }`. |
| `nextCutoff(period)` | pure | Step one semi-monthly period forward. `11–25` → `26–10` (same month 26 → next month 10). `26–10` → `11–25` (next month 11–25). Derived from `periodStart` day. |
| `activeCutoff(companyId)` | async | Return oldest `OPEN` `PayrollPeriod`. If none exists, derive `cutoffForDate(nowPH())`, upsert an `OPEN` row for it, and return it. |
| `closeCutoff(companyId, period, userId)` | async | Guard: throw/return error if any `DRAFT` `Payroll` row exists for the period. Otherwise set the period `CLOSED` + stamp `closedBy`/`closedAt`, then upsert an `OPEN` row for `nextCutoff(period)` so work advances exactly one period. |

`nowPH()` already exists in `src/lib/format.ts` and is the canonical "now". Attendance keeps
calling `cutoffForDate` (calendar-date behaviour, unchanged).

## UI Changes

- **`payroll/page.tsx`** — replace the local `currentCutoff()` with `await activeCutoff(companyId)`.
  Add a **Close cutoff** server action + button, shown only when viewing the current (open) cutoff.
  Button is disabled when `draftCount > 0`, with hint: "Release all payslips before closing."
  Closing redirects back to `/payroll`, now showing the next period. Remove the now-unused local
  `currentCutoff`.
- **`ot-approval/page.tsx`** — replace local `currentCutoff()` with `await activeCutoff(companyId)`.
- **`dashboard/page.tsx`** — replace local `currentCutoff()` with `await activeCutoff(companyId)`
  (informational OT summary now reflects the open cutoff).
- **`attendance/page.tsx`** — replace local `currentCutoff()` with the shared **`cutoffForDate`**
  (calendar date, behaviour unchanged — just de-duplicated).

## Migration to Production

1. Prisma schema migration adds the `PayrollPeriod` table. Applied in prod through the existing
   `scripts/turso-migrate.mjs` path invoked by `npm run build`.
2. **Backfill** (one-time, idempotent): for each distinct `(periodStart, periodEnd)` in `Payroll`,
   upsert a `PayrollPeriod`. `status = CLOSED` if every `Payroll` row for that period is `RELEASED`,
   else `OPEN`. Result in current prod: `26–10` (has drafts) → `OPEN`; all older periods → `CLOSED`.
   No payroll data is mutated. Fully reversible by dropping the table.

The backfill must run per company. It is safe to re-run (upsert on the unique key).

## Testing

- **vitest** (new dev dependency) — unit tests for the pure functions:
  - `cutoffForDate`: boundary days 10/11/25/26, month rollover (Dec→Jan), year rollover.
  - `nextCutoff`: `11–25` → `26–10` → `11–25` sequence, including month/year rollover.
- **Playwright e2e** — close-and-advance flow:
  - Close blocked while a DRAFT payslip exists (button disabled / action rejects).
  - Release all → Close → payroll page advances to the next period; the closed period appears in
    history as CLOSED.

## Out of Scope

- Re-opening a closed cutoff (no un-close action this iteration).
- Changing attendance, OT-rate, or contribution logic.
- Multi-company concurrency beyond the per-company `OPEN` invariant.

## Files Touched

- `prisma/schema.prisma` — add `PayrollPeriod`, `Company.payrollPeriods` back-relation.
- `prisma/migrations/**` — new migration.
- `src/lib/cutoff.ts` — new.
- `src/lib/cutoff.test.ts` — new (vitest).
- `src/app/(app)/payroll/page.tsx` — active cutoff + Close action/button.
- `src/app/(app)/ot-approval/page.tsx` — active cutoff.
- `src/app/(app)/dashboard/page.tsx` — active cutoff.
- `src/app/(app)/attendance/page.tsx` — shared `cutoffForDate`.
- `scripts/backfill-payroll-periods.mjs` — one-time backfill (or fold into migrate script).
- `tests/payroll-cutoff.spec.ts` — new Playwright e2e.
- `package.json` — vitest dev dep + `test:unit` script.
