# Payroll Cutoff Close Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the payroll cutoff from auto-advancing by calendar date; make it advance only when the current cutoff is explicitly closed (and only after all payslips are released).

**Architecture:** A new `PayrollPeriod` table holds an `OPEN | CLOSED` status per company per cutoff. The payroll and OT-approval pages read the oldest `OPEN` period as the "active cutoff" instead of deriving it from today's date. A **Close cutoff** action (gated on zero `DRAFT` payslips) marks the period `CLOSED` and opens the next one. Pure cutoff date math is extracted to one module and unit-tested; the DB lifecycle lives in a second module.

**Tech Stack:** Next.js 15 (App Router, server components + server actions), Prisma 5 + SQLite (local) / Turso libSQL (prod), vitest (new, unit), Playwright (existing, e2e).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/cutoff.ts` (new) | Pure date math: `cutoffForDate`, `nextCutoff`, `monthCutoffLabel`, `Cutoff` type. No DB imports. |
| `src/lib/cutoff.test.ts` (new) | vitest unit tests for the pure functions. |
| `src/lib/payroll-period.ts` (new) | DB lifecycle: `activeCutoff`, `ensureOpenPeriod`, `closeCutoff`. Imports prisma + cutoff. |
| `prisma/schema.prisma` (modify) | Add `PayrollPeriod` model + `Company.payrollPeriods` back-relation. |
| `src/app/(app)/payroll/page.tsx` (modify) | Use `activeCutoff`; add Close action + button; ensure OPEN period on run. Remove local `currentCutoff`. |
| `src/app/(app)/ot-approval/page.tsx` (modify) | Use `activeCutoff`. Remove local `currentCutoff`. |
| `src/app/(app)/dashboard/page.tsx` (modify) | Use `activeCutoff`. Remove local `currentCutoff`. |
| `src/app/(app)/attendance/page.tsx` (modify) | Use shared `cutoffForDate` + `monthCutoffLabel`. Remove local `currentCutoff`. |
| `scripts/turso-migrate.mjs` (modify) | Idempotent `PayrollPeriod` table create + one-time backfill (prod). |
| `tests/payroll-cutoff.spec.ts` (new) | Playwright e2e: close gated by drafts, then advances. |
| `vitest.config.ts` (new) | vitest config with `@` alias. |
| `package.json` (modify) | Add `vitest` devDep + `test:unit` script. |

---

### Task 1: Pure cutoff module + vitest unit tests

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/cutoff.ts`
- Test: `src/lib/cutoff.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`
Expected: `vitest` added to devDependencies, no errors.

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 3: Add the `test:unit` script**

In `package.json`, add to `"scripts"` (keep `"test": "playwright test"` unchanged):

```json
"test:unit": "vitest run",
```

- [ ] **Step 4: Write the failing tests**

Create `src/lib/cutoff.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cutoffForDate, nextCutoff } from "@/lib/cutoff";

const ymd = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate()];

describe("cutoffForDate", () => {
  it("day 11 → 11–25 of same month", () => {
    const c = cutoffForDate(new Date(2026, 5, 11)); // Jun 11 2026
    expect(c.label).toBe("11–25");
    expect(ymd(c.start)).toEqual([2026, 5, 11]);
    expect(ymd(c.end)).toEqual([2026, 5, 25]);
  });
  it("day 25 → 11–25", () => {
    expect(cutoffForDate(new Date(2026, 5, 25)).label).toBe("11–25");
  });
  it("day 26 → 26–10 spanning into next month", () => {
    const c = cutoffForDate(new Date(2026, 5, 26)); // Jun 26
    expect(c.label).toBe("26–10");
    expect(ymd(c.start)).toEqual([2026, 5, 26]);
    expect(ymd(c.end)).toEqual([2026, 6, 10]); // Jul 10
  });
  it("day 10 → 26–10 starting last month", () => {
    const c = cutoffForDate(new Date(2026, 5, 10)); // Jun 10
    expect(c.label).toBe("26–10");
    expect(ymd(c.start)).toEqual([2026, 4, 26]); // May 26
    expect(ymd(c.end)).toEqual([2026, 5, 10]);   // Jun 10
  });
  it("year rollover: Jan 5 → 26–10 starting prev Dec", () => {
    const c = cutoffForDate(new Date(2026, 0, 5)); // Jan 5 2026
    expect(ymd(c.start)).toEqual([2025, 11, 26]); // Dec 26 2025
    expect(ymd(c.end)).toEqual([2026, 0, 10]);    // Jan 10 2026
  });
});

describe("nextCutoff", () => {
  it("11–25 → 26–10 spanning into next month", () => {
    const c = nextCutoff({ start: new Date(2026, 5, 11) }); // Jun 11
    expect(c.label).toBe("26–10");
    expect(ymd(c.start)).toEqual([2026, 5, 26]);
    expect(ymd(c.end)).toEqual([2026, 6, 10]);
  });
  it("26–10 → 11–25 of next month", () => {
    const c = nextCutoff({ start: new Date(2026, 4, 26) }); // May 26
    expect(c.label).toBe("11–25");
    expect(ymd(c.start)).toEqual([2026, 5, 11]); // Jun 11
    expect(ymd(c.end)).toEqual([2026, 5, 25]);
  });
  it("year rollover: Dec 26 → Jan 11–25", () => {
    const c = nextCutoff({ start: new Date(2025, 11, 26) }); // Dec 26 2025
    expect(ymd(c.start)).toEqual([2026, 0, 11]); // Jan 11 2026
    expect(ymd(c.end)).toEqual([2026, 0, 25]);
  });
  it("sequence advances one period at a time", () => {
    const a = nextCutoff({ start: new Date(2026, 4, 26) }); // → Jun 11–25
    const b = nextCutoff(a);                                 // → Jun 26–10
    expect(b.label).toBe("26–10");
    expect(ymd(b.start)).toEqual([2026, 5, 26]);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `cutoff.ts` does not exist / `cutoffForDate is not a function`.

- [ ] **Step 6: Implement the module**

Create `src/lib/cutoff.ts`:

```ts
import { nowPH } from "@/lib/format";

export interface Cutoff {
  start: Date;
  end: Date;
  label: string; // "11–25" | "26–10"  (en dash U+2013)
}

/**
 * The semi-monthly cutoff that `now` falls in (MMTSI schedule):
 *   day 11–25 → 11–25 (this month)
 *   day ≥ 26  → 26–10 (this month 26 → next month 10)
 *   day 1–10  → 26–10 (last month 26 → this month 10)
 * Dates use the local Date constructor to match how periods are stored elsewhere.
 */
export function cutoffForDate(now: Date = nowPH()): Cutoff {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (d >= 11 && d <= 25) {
    return { start: new Date(y, m, 11), end: new Date(y, m, 25), label: "11–25" };
  }
  if (d >= 26) {
    return { start: new Date(y, m, 26), end: new Date(y, m + 1, 10), label: "26–10" };
  }
  return { start: new Date(y, m - 1, 26), end: new Date(y, m, 10), label: "26–10" };
}

/**
 * The cutoff immediately after `period`, derived from its start day:
 *   11–25 → 26–10 (same month 26 → next month 10)
 *   26–10 → 11–25 (next month 11 → next month 25)
 */
export function nextCutoff(period: { start: Date }): Cutoff {
  const s = period.start;
  const y = s.getFullYear();
  const m = s.getMonth();
  if (s.getDate() === 11) {
    return { start: new Date(y, m, 26), end: new Date(y, m + 1, 10), label: "26–10" };
  }
  return { start: new Date(y, m + 1, 11), end: new Date(y, m + 1, 25), label: "11–25" };
}

/** Month-prefixed label e.g. "June 11–25" for pages that show the month. */
export function monthCutoffLabel(c: { start: Date; label: string }): string {
  const month = c.start.toLocaleString("en-PH", { month: "long", timeZone: "Asia/Manila" });
  return `${month} ${c.label}`;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS — all `cutoffForDate` and `nextCutoff` cases green.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/cutoff.ts src/lib/cutoff.test.ts
git commit -m "feat(payroll): pure cutoff date math + vitest unit tests"
```

---

### Task 2: PayrollPeriod schema + local DB

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

In `prisma/schema.prisma`, after the `OTApproval` model, add:

```prisma
model PayrollPeriod {
  id          String    @id @default(cuid())
  companyId   String
  company     Company   @relation(fields: [companyId], references: [id])
  periodStart DateTime
  periodEnd   DateTime
  label       String
  status      String    @default("OPEN") // OPEN | CLOSED
  closedBy    String?
  closedAt    DateTime?
  createdAt   DateTime  @default(now())
  @@unique([companyId, periodStart, periodEnd])
}
```

- [ ] **Step 2: Add the back-relation on Company**

In the `Company` model, alongside `otApprovals OTApproval[]`, add:

```prisma
  payrollPeriods    PayrollPeriod[]
```

- [ ] **Step 3: Push schema to local DB + regenerate client**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." and `prisma generate` runs (creates `payrollPeriod` on the client).

- [ ] **Step 4: Verify the client type exists**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors. (`prisma.payrollPeriod` is now typed; nothing references it yet so this just confirms the schema compiles.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(payroll): add PayrollPeriod model (OPEN/CLOSED lifecycle)"
```

---

### Task 3: PayrollPeriod DB lifecycle module

**Files:**
- Create: `src/lib/payroll-period.ts`

- [ ] **Step 1: Implement the module**

Create `src/lib/payroll-period.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { nowPH } from "@/lib/format";
import { cutoffForDate, nextCutoff, type Cutoff } from "@/lib/cutoff";

/**
 * The active cutoff for a company = the oldest OPEN PayrollPeriod.
 * Falls back to the date-derived cutoff when no OPEN period exists yet
 * (fresh company / before any payroll run). Read-only: OPEN rows are created
 * on write paths (ensureOpenPeriod / closeCutoff) and by the prod backfill.
 */
export async function activeCutoff(companyId: string): Promise<Cutoff> {
  const open = await prisma.payrollPeriod.findFirst({
    where: { companyId, status: "OPEN" },
    orderBy: { periodStart: "asc" },
  });
  if (open) {
    return { start: open.periodStart, end: open.periodEnd, label: open.label };
  }
  return cutoffForDate(nowPH());
}

/** Idempotently ensure an OPEN PayrollPeriod row exists for the given cutoff. */
export async function ensureOpenPeriod(companyId: string, c: Cutoff): Promise<void> {
  await prisma.payrollPeriod.upsert({
    where: { companyId_periodStart_periodEnd: { companyId, periodStart: c.start, periodEnd: c.end } },
    update: {},
    create: { companyId, periodStart: c.start, periodEnd: c.end, label: c.label, status: "OPEN" },
  });
}

/**
 * Close `period` and open the next cutoff so work advances exactly one period.
 * Guard: refuses while any DRAFT payroll row exists for the period. Returns
 * { ok: false, reason: "DRAFTS_EXIST" } when blocked.
 */
export async function closeCutoff(
  companyId: string,
  period: Cutoff,
  userId: string | undefined,
): Promise<{ ok: boolean; reason?: string }> {
  const drafts = await prisma.payroll.count({
    where: { periodStart: period.start, periodEnd: period.end, status: "DRAFT" },
  });
  if (drafts > 0) return { ok: false, reason: "DRAFTS_EXIST" };

  await prisma.payrollPeriod.upsert({
    where: { companyId_periodStart_periodEnd: { companyId, periodStart: period.start, periodEnd: period.end } },
    update: { status: "CLOSED", closedBy: userId ?? null, closedAt: new Date() },
    create: {
      companyId, periodStart: period.start, periodEnd: period.end, label: period.label,
      status: "CLOSED", closedBy: userId ?? null, closedAt: new Date(),
    },
  });

  await ensureOpenPeriod(companyId, nextCutoff(period));
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (Confirms the Prisma `companyId_periodStart_periodEnd` compound key and `payrollPeriod` delegate names are correct.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/payroll-period.ts
git commit -m "feat(payroll): activeCutoff / closeCutoff lifecycle helpers"
```

---

### Task 4: Wire the payroll page (active cutoff + Close action)

**Files:**
- Modify: `src/app/(app)/payroll/page.tsx`

- [ ] **Step 1: Replace imports and remove the local `currentCutoff`**

At the top of `src/app/(app)/payroll/page.tsx`, add to the existing imports:

```ts
import { activeCutoff, closeCutoff, ensureOpenPeriod } from "@/lib/payroll-period";
import { Lock } from "lucide-react";
```

Delete the local `function currentCutoff(now = nowPH()) { ... }` block (the one spanning the `if (day >= 11 ...)` logic).

- [ ] **Step 2: Ensure an OPEN period when payroll is run**

In `runPayroll`, immediately before the closing `await logAudit({ ... action: "PAYROLL_RUN" ... })` call (after the employee `for` loop), add:

```ts
  const runLabel = start.getDate() === 11 ? "11–25" : "26–10";
  await ensureOpenPeriod(companyId, { start, end, label: runLabel });
```

- [ ] **Step 3: Add the Close cutoff server action**

Add this server action next to `releaseAllPayroll` (above `runPayroll` is fine):

```ts
async function closeCutoffAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true, companyId: true },
  });
  if (!user?.companyId) redirect("/dashboard");
  const start = new Date(String(formData.get("start")));
  const end   = new Date(String(formData.get("end")));
  const label = start.getDate() === 11 ? "11–25" : "26–10";

  const result = await closeCutoff(user.companyId, { start, end, label }, user.id);
  if (!result.ok) {
    redirect(`/payroll?toast=${encodeURIComponent("Release all payslips before closing this cutoff")}`);
  }
  await logAudit({
    companyId: user.companyId, userId: user.id,
    action: "PAYROLL_CUTOFF_CLOSE", target: "PayrollPeriod",
    meta: { start: start.toISOString(), end: end.toISOString() },
  });
  revalidateTag(CACHE_TAGS.PAYROLL);
  redirect(`/payroll?toast=${encodeURIComponent("Cutoff closed — advanced to next period")}`);
}
```

- [ ] **Step 4: Use the active cutoff in the page**

In `PayrollPage`, the page currently does `const cutoff = currentCutoff();` near the top, before resolving the user. Replace the ordering so the company is known first. Find:

```ts
  const { period } = await searchParams;
  const cutoff = currentCutoff();

  const session = await auth();
  if (!session) redirect("/login");
  const pageUser = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const pageCompanyId = pageUser?.companyId ?? "";
```

Replace with:

```ts
  const { period } = await searchParams;

  const session = await auth();
  if (!session) redirect("/login");
  const pageUser = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const pageCompanyId = pageUser?.companyId ?? "";

  const cutoff = await activeCutoff(pageCompanyId);
```

- [ ] **Step 5: Add the Close cutoff button**

In the returned JSX, inside the `{isCurrentCutoff && ( <> ... </> )}` block, after the `Release all` `<form>...</form>`, add:

```tsx
              <form action={closeCutoffAction}>
                <input type="hidden" name="start" value={cutoff.start.toISOString()} />
                <input type="hidden" name="end"   value={cutoff.end.toISOString()} />
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  disabled={draftCount > 0}
                  title={draftCount > 0 ? "Release all payslips before closing" : "Close this cutoff and advance to the next"}
                >
                  <Lock className="h-4 w-4" />
                  Close cutoff
                </Button>
              </form>
```

(`draftCount` is already computed earlier in `PayrollPage` and is in scope here.)

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors. (`nowPH` may now be unused in this file — if lint flags it, remove `nowPH` from the `@/lib/format` import.)

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/payroll/page.tsx"
git commit -m "feat(payroll): pin page to active OPEN cutoff + Close cutoff action"
```

---

### Task 5: Wire OT-approval, dashboard, attendance

**Files:**
- Modify: `src/app/(app)/ot-approval/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/attendance/page.tsx`

- [ ] **Step 1: OT-approval → activeCutoff**

In `src/app/(app)/ot-approval/page.tsx`:
- Delete the local `function currentCutoff(now = new Date()) { ... }`.
- Add import: `import { activeCutoff, monthCutoffLabel } from "@/lib/payroll-period";` — wait, `monthCutoffLabel` lives in `@/lib/cutoff`. Use two imports:

```ts
import { activeCutoff } from "@/lib/payroll-period";
import { monthCutoffLabel } from "@/lib/cutoff";
```

- Replace `const cutoff = currentCutoff();` with `const cutoff = await activeCutoff(user.companyId);` (the page already loads `user` with `companyId` and redirects if missing).
- If the page renders a cutoff label string built from the old function, render `monthCutoffLabel(cutoff)` instead.

- [ ] **Step 2: Dashboard → activeCutoff**

In `src/app/(app)/dashboard/page.tsx`:
- Delete the local `function currentCutoff(now = new Date()) { ... }`.
- Add imports:

```ts
import { activeCutoff } from "@/lib/payroll-period";
import { monthCutoffLabel } from "@/lib/cutoff";
```

- Replace `const cutoff = currentCutoff(now);` with `const cutoff = await activeCutoff(companyId);`. If `companyId` is not already in scope at that point, derive it from the loaded user (`const companyId = user?.companyId ?? ""` — match the variable already used by the page's queries). If the page shows `cutoff.label`, use `monthCutoffLabel(cutoff)`.

- [ ] **Step 3: Attendance → shared cutoffForDate (calendar date, unchanged behavior)**

In `src/app/(app)/attendance/page.tsx`:
- Delete the local `function currentCutoff(now = nowPH()) { ... }`.
- Add import: `import { cutoffForDate, monthCutoffLabel } from "@/lib/cutoff";`
- Replace the `const cc = currentCutoff(now);` call (in the else branch that sets `histFrom/histTo/histLabel`) with:

```ts
    const cc = cutoffForDate(now);
    histFrom = cc.start; histTo = cc.end;
    histLabel = `Current cutoff (${monthCutoffLabel(cc)})`;
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors. Remove any now-unused `nowPH` imports the linter flags.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/ot-approval/page.tsx" "src/app/(app)/dashboard/page.tsx" "src/app/(app)/attendance/page.tsx"
git commit -m "feat(payroll): OT-approval + dashboard follow active cutoff; attendance de-duped"
```

---

### Task 6: Production migration — PayrollPeriod table + backfill

**Files:**
- Modify: `scripts/turso-migrate.mjs`

- [ ] **Step 1: Add the table creation + backfill call**

In `scripts/turso-migrate.mjs`, inside `main()`, immediately before the final `console.log("Turso migration: done.");`, add:

```js
  // PayrollPeriod table — OPEN/CLOSED cutoff lifecycle
  if (!(await tableExists("PayrollPeriod"))) {
    await db.execute(`
      CREATE TABLE "PayrollPeriod" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "companyId"   TEXT NOT NULL,
        "periodStart" DATETIME NOT NULL,
        "periodEnd"   DATETIME NOT NULL,
        "label"       TEXT NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'OPEN',
        "closedBy"    TEXT,
        "closedAt"    DATETIME,
        "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PayrollPeriod_companyId_fkey"
          FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
          ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await db.execute(`
      CREATE UNIQUE INDEX "PayrollPeriod_companyId_periodStart_periodEnd_key"
        ON "PayrollPeriod" ("companyId", "periodStart", "periodEnd")
    `);
    console.log("  created PayrollPeriod table");
    await backfillPayrollPeriods();
  } else {
    console.log("  skip PayrollPeriod table (exists)");
  }
```

- [ ] **Step 2: Add the backfill function**

In `scripts/turso-migrate.mjs`, add this function next to `fixPayrollPeriodDates` (top-level, before `main().catch(...)`):

```js
async function backfillPayrollPeriods() {
  console.log("  backfilling PayrollPeriod from existing Payroll...");
  // Payroll has no companyId — resolve it through Employee.
  const periods = await db.execute(`
    SELECT DISTINCT e."companyId" AS companyId, p."periodStart" AS periodStart, p."periodEnd" AS periodEnd
    FROM "Payroll" p
    JOIN "Employee" e ON e."id" = p."employeeId"
  `);
  let open = 0, closed = 0;
  for (const row of periods.rows) {
    const companyId   = row.companyId;
    const periodStart = row.periodStart;
    const periodEnd   = row.periodEnd;
    const draftRes = await db.execute(
      `SELECT COUNT(*) AS n FROM "Payroll" p
       JOIN "Employee" e ON e."id" = p."employeeId"
       WHERE e."companyId"=? AND p."periodStart"=? AND p."periodEnd"=? AND p."status"='DRAFT'`,
      [companyId, periodStart, periodEnd]
    );
    const hasDrafts = Number(draftRes.rows[0]?.n ?? 0) > 0;
    const status = hasDrafts ? "OPEN" : "CLOSED";
    const day = new Date(periodStart).getUTCDate();
    const label = day === 11 ? "11–25" : "26–10";
    const id = `pp-${companyId}-${String(periodStart).slice(0, 10)}`;
    await db.execute(
      `INSERT OR IGNORE INTO "PayrollPeriod"
         ("id","companyId","periodStart","periodEnd","label","status","createdAt")
       VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
      [id, companyId, periodStart, periodEnd, label, status]
    );
    if (status === "OPEN") open++; else closed++;
  }
  console.log(`  PayrollPeriod backfill done — ${open} OPEN, ${closed} CLOSED.`);
}
```

- [ ] **Step 3: Syntax-check the script**

Run: `node --check scripts/turso-migrate.mjs`
Expected: no output (valid syntax). The script is a no-op without `TURSO_*` env vars, so it is safe to leave unrun locally.

- [ ] **Step 4: Commit**

```bash
git add scripts/turso-migrate.mjs
git commit -m "feat(payroll): prod PayrollPeriod table + backfill in turso-migrate"
```

---

### Task 7: Playwright e2e — close gating + advance

**Files:**
- Create: `tests/payroll-cutoff.spec.ts`

> **Precondition for running:** dev server up (`npm run dev`) against a freshly seeded DB (`npm run db:seed`). The test closes a cutoff (a one-way mutation), so re-seed before re-running.

- [ ] **Step 1: Write the e2e spec**

Create `tests/payroll-cutoff.spec.ts`:

```ts
/**
 * Payroll cutoff close-gating e2e.
 * Requires: npm run dev (localhost:3000) on a freshly seeded DB (npm run db:seed).
 * The test closes a cutoff — re-seed before re-running.
 */
import { test, expect, type Page } from "@playwright/test";

const OWNER_EMAIL = "louie.castillo@mmtsi.ph";
const OWNER_PASS  = "demo1234";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("input[name='email']", OWNER_EMAIL);
  await page.fill("input[name='password']", OWNER_PASS);
  await page.click("button[type='submit']");
  await expect(page).toHaveURL(/\/dashboard/);
}

test("close cutoff is blocked until all payslips released, then advances", async ({ page }) => {
  await login(page);
  await page.goto("/payroll");

  const subtitle = page.locator("p", { hasText: /Current cutoff/ });
  const before = (await subtitle.innerText()).trim();

  // Run payroll → creates DRAFT payslips for the cutoff
  await page.getByRole("button", { name: /Run payroll|Re-run payroll/ }).click();
  await page.waitForLoadState("networkidle");

  // Close must be disabled while DRAFT payslips exist
  const closeBtn = page.getByRole("button", { name: "Close cutoff" });
  await expect(closeBtn).toBeDisabled();

  // Release all payslips
  await page.getByRole("button", { name: /Release all/ }).click();
  await page.waitForLoadState("networkidle");

  // Close now enabled → advances to next cutoff
  await expect(closeBtn).toBeEnabled();
  await closeBtn.click();
  await page.waitForLoadState("networkidle");

  const after = (await page.locator("p", { hasText: /Current cutoff/ }).innerText()).trim();
  expect(after).not.toEqual(before);
});
```

- [ ] **Step 2: Run it (with dev server + seeded DB)**

Run (in a separate shell, dev server already running):
```bash
npm run db:seed
npx playwright test tests/payroll-cutoff.spec.ts
```
Expected: 1 passed. If selectors differ from the rendered markup, adjust the locators to match (button text / subtitle text) and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/payroll-cutoff.spec.ts
git commit -m "test(payroll): e2e for cutoff close gating + advance"
```

---

### Task 8: Final verification + merge handoff

- [ ] **Step 1: Unit tests**

Run: `npm run test:unit`
Expected: all cutoff tests pass.

- [ ] **Step 2: Lint + typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds. (`turso-migrate.mjs` self-skips locally without `TURSO_*` env vars.)

- [ ] **Step 4: Manual smoke (dev server)**

With `npm run dev` + seeded DB: load `/payroll`, confirm it shows the open cutoff (26–10 after backfill in prod-like data), the **Close cutoff** button is disabled while drafts exist, releasing all enables it, and clicking it advances to 11–25 and lists the closed period under history. Confirm `/ot-approval` shows the same active cutoff and `/attendance` still tracks the calendar date.

- [ ] **Step 5: Merge handoff**

Stop here and confirm the production target branch with the user before merging (`dev` → production). Do not push or merge without confirmation.

---

## Self-Review

**Spec coverage:**
- Explicit Close + `PayrollPeriod` OPEN/CLOSED → Task 2 (model), Task 3 (`closeCutoff`), Task 4 (button/action). ✓
- Payroll shows oldest OPEN → Task 3 (`activeCutoff`), Task 4. ✓
- OT-approval follows active cutoff; attendance stays on calendar date; dashboard shows open cutoff → Task 5. ✓
- Close only when all released → Task 3 guard + Task 4 disabled button. ✓
- Migration + backfill (CLOSED if all released else OPEN; join via Employee) → Task 6. ✓
- vitest pure tests + Playwright e2e → Task 1, Task 7. ✓

**Placeholder scan:** none — every step has full code/commands.

**Type consistency:** `Cutoff { start, end, label }` defined in Task 1, consumed unchanged in Tasks 3–5. Delegate `prisma.payrollPeriod` + compound key `companyId_periodStart_periodEnd` used consistently (Task 3) and matches the `@@unique` in Task 2 and the existing `OTApproval` usage. `closeCutoff` / `activeCutoff` / `ensureOpenPeriod` signatures match their call sites in Task 4.
