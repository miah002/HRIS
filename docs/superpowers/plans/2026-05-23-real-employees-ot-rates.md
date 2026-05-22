# Real Employees + Full PH OT Rate Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 15 random demo employees with 8 real MMTSI employees, fix daily-rate formula to monthly/21.75, and add a full 17-code PH Labor Code OT rate table with dropdown selection in attendance and per-row multiplier in payroll computation.

**Architecture:** Schema gets one nullable `otRateCode` column on `Attendance`. The payroll library (`ph-payroll.ts`) gains the `OT_RATES` map and accepts three pre-computed pay buckets so the payroll run page can aggregate per-row rate codes before calling the function. The attendance manual-entry form adds a Rate Code select. The seed is fully rewritten for 8 specific employees.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM + SQLite, Server Actions, Tailwind CSS

---

## File Map

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `otRateCode String?` to `Attendance` model |
| `prisma/seed.ts` | Rewrite | 8 real employees + all 8 get portal login |
| `src/lib/ph-payroll.ts` | Modify | `OT_RATES` map, `monthly/21.75` formula, `overtimePayIn/nightDiffPayIn/holidayPayIn` overrides in `PayrollInput` |
| `src/app/(app)/attendance/page.tsx` | Modify | Rate Code dropdown in manual entry, Rate column in table, save `otRateCode` in `logManual` |
| `src/app/(app)/payroll/page.tsx` | Modify | Aggregate OT pay by rate code bucket before calling `computeSemiMonthlyPayroll` |

---

## Task 1: Schema — add `otRateCode` to Attendance

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field**

In `prisma/schema.prisma`, find the `Attendance` model and add `otRateCode` after `isHoliday`:

```prisma
model Attendance {
  id          String    @id @default(cuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  date        DateTime
  timeIn      DateTime?
  timeOut     DateTime?
  hoursWorked Float     @default(0)
  otHours     Float     @default(0)
  ndHours     Float     @default(0)
  isRestDay   Boolean   @default(false)
  isHoliday   Boolean   @default(false)
  otRateCode  String?
  notes       String?
  @@unique([employeeId, date])
}
```

- [ ] **Step 2: Push schema to DB**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` line in output.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add otRateCode to Attendance"
```

---

## Task 2: Payroll library — OT_RATES, daily rate formula, computed-pay overrides

**Files:**
- Modify: `src/lib/ph-payroll.ts`

- [ ] **Step 1: Replace OT_MULTIPLIERS with OT_RATES and fix daily rate formula**

Replace the `OT_MULTIPLIERS` block and the `hourlyRate` function (lines 80–92) with:

```ts
export const OT_RATES: Record<string, number> = {
  R_OT:      1.25,
  RD:        1.30,
  RD_OT:     1.69,
  SH:        1.30,
  SH_OT:     1.69,
  SH_RD:     1.50,
  SH_RD_OT:  1.95,
  RH:        2.00,
  RH_OT:     2.60,
  RH_RD:     2.60,
  RH_RD_OT:  3.38,
  ND:        1.10,
  ND_OT:     1.38,
  ND_SH:     1.43,
  ND_SH_OT:  1.86,
  ND_RH:     2.20,
  ND_RH_OT:  2.86,
};

// Deprecated alias — keeps existing imports working
export const OT_MULTIPLIERS = {
  regular:        OT_RATES.R_OT,
  restDay:        OT_RATES.RD,
  specialDay:     OT_RATES.SH,
  regularHoliday: OT_RATES.RH,
  ndPremium:      0.10,
};

export function hourlyRate(monthlyRate: number) {
  // 21.75 = 261 working days / 12 months (5-day week DOLE standard)
  return (monthlyRate / 21.75) / 8;
}
```

- [ ] **Step 2: Update PayrollInput to accept pre-computed pay buckets**

Replace the `PayrollInput` interface (lines 97–114) with:

```ts
export interface PayrollInput {
  monthlyRate: number;
  periodStart: Date;
  periodEnd: Date;
  daysWorked?: number;
  regularHours?: number;
  otHours?: number;
  otRateCode?: string;          // rate code when otHours is a single-bucket value
  ndHours?: number;
  holidayPay?: number;
  allowances?: number;
  taxableAdjustments?: number;
  nonTaxableAdjustments?: number;
  otherDeductions?: number;
  // Pre-computed overrides: when payroll run aggregates per-row rate codes,
  // these bypass the otHours/ndHours calculation entirely.
  overtimePayIn?: number;
  nightDiffPayIn?: number;
  holidayPayIn?: number;
}
```

- [ ] **Step 3: Update computeSemiMonthlyPayroll to use OT_RATES and overrides**

Replace the body of `computeSemiMonthlyPayroll` (lines 116–178) with:

```ts
export function computeSemiMonthlyPayroll(i: PayrollInput) {
  const hr = hourlyRate(i.monthlyRate);
  const dailyRate = round2(i.monthlyRate / 21.75);

  const basicPay = i.daysWorked != null && i.daysWorked > 0
    ? round2(i.daysWorked * dailyRate)
    : round2(i.monthlyRate / 2);

  // Use pre-computed buckets when provided (payroll run with per-row rate codes),
  // otherwise fall back to single-bucket otHours calculation.
  const otPay = i.overtimePayIn != null
    ? round2(i.overtimePayIn)
    : round2((i.otHours ?? 0) * hr * (OT_RATES[i.otRateCode ?? "R_OT"] ?? 1.25));

  const ndPay = i.nightDiffPayIn != null
    ? round2(i.nightDiffPayIn)
    : round2((i.ndHours ?? 0) * hr * OT_RATES.ND);

  const holidayPay = i.holidayPayIn != null
    ? round2(i.holidayPayIn)
    : (i.holidayPay ?? 0);

  const allowances = i.allowances ?? 0;
  const taxableAdj = i.taxableAdjustments ?? 0;
  const nonTaxableAdj = i.nonTaxableAdjustments ?? 0;

  const grossPay = round2(basicPay + otPay + ndPay + holidayPay + allowances + taxableAdj + nonTaxableAdj);

  const sss  = sssContribution(i.monthlyRate);
  const phic = philHealthContribution(i.monthlyRate);
  const hdmf = pagIbigContribution(i.monthlyRate);

  const sssEE  = round2(sss.employee / 2);
  const phicEE = round2(phic.employee / 2);
  const hdmfEE = round2(hdmf.employee / 2);

  const monthlyStatutory = sss.employee + phic.employee + hdmf.employee;
  const taxableSemi = basicPay + otPay + taxableAdj;
  const taxableMonthly = Math.max(0, taxableSemi * 2 - monthlyStatutory);
  const monthlyWHT = withholdingTaxMonthly(taxableMonthly);
  const whtSemi = round2(monthlyWHT / 2);

  const otherDed = i.otherDeductions ?? 0;
  const totalDeductions = round2(sssEE + phicEE + hdmfEE + whtSemi + otherDed);
  const netPay = round2(grossPay - totalDeductions);

  return {
    daysWorked: i.daysWorked ?? 0,
    regularHours: i.regularHours ?? 0,
    basicPay,
    overtimePay: otPay,
    nightDiffPay: ndPay,
    holidayPay,
    allowances,
    taxableAdjustments: taxableAdj,
    nonTaxableAdjustments: nonTaxableAdj,
    grossPay,
    sssEE,
    philHealthEE: phicEE,
    pagIbigEE: hdmfEE,
    withholdingTax: whtSemi,
    otherDeductions: otherDed,
    totalDeductions,
    netPay,
    sssER: round2(sss.employer / 2),
    philHealthER: round2(phic.employer / 2),
    pagIbigER: round2(hdmf.employer / 2),
  };
}
```

- [ ] **Step 4: Verify formula manually**

Run this quick check in the terminal to confirm the daily rate formula is correct:

```bash
node -e "
const monthly = 20000;
const daily = monthly / 21.75;
const hourly = daily / 8;
const otPay = 2 * hourly * 1.25;
console.log('daily:', daily.toFixed(2));   // expect 919.54
console.log('hourly:', hourly.toFixed(4)); // expect 114.9425
console.log('2h R_OT:', otPay.toFixed(2)); // expect 287.36
"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ph-payroll.ts
git commit -m "feat(payroll): OT_RATES table, monthly/21.75 daily rate, computed-pay overrides"
```

---

## Task 3: Attendance page — Rate Code dropdown + Rate column

**Files:**
- Modify: `src/app/(app)/attendance/page.tsx`

- [ ] **Step 1: Add OT_RATES import and define dropdown options**

At the top of the file, change the `ph-payroll` import:

```ts
import { OT_RATES } from "@/lib/ph-payroll";
```

Add this constant after the imports (before `todayPH()`):

```ts
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
```

- [ ] **Step 2: Save otRateCode in logManual server action**

In the `logManual` server action, after computing `otHours`, add:

```ts
const otRateCode = formData.get("otRateCode") as string | null;
```

Then add `otRateCode: otRateCode || null` to both the `update` and `create` blocks of the `prisma.attendance.upsert` call:

```ts
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
```

- [ ] **Step 3: Add Rate Code dropdown to the manual entry form**

In the manual entry form JSX, add a new grid cell after the Time Out field and before the Flags cell:

```tsx
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
```

Also update the grid className from `grid sm:grid-cols-3 lg:grid-cols-6` to `grid sm:grid-cols-3 lg:grid-cols-7` to accommodate the new column.

- [ ] **Step 4: Add Rate column to the attendance table**

In the `<TableHeader>` row, add a new `<Th>` after the OT column:

```tsx
<Th>Rate</Th>
```

In the `<TableBody>` rows, add a new `<Td>` after the OT hours cell:

```tsx
<Td>
  {rec?.otRateCode
    ? <Badge variant="neutral">{rec.otRateCode.replace(/_/g, " ")}</Badge>
    : <span className="text-[var(--text-tertiary)]">—</span>
  }
</Td>
```

- [ ] **Step 5: Update the footnote text**

Replace the existing `<p>` footnote at the bottom:

```tsx
<p className="text-2xs text-[var(--text-tertiary)]">
  OT computed automatically: hours beyond 8 = regular OT at ×{OT_RATES.R_OT} (Labor Code Art. 87).
  Use manual entry to tag rest-day, holiday, or night differential rate codes — these flow into the correct payslip buckets at payroll run.
</p>
```

- [ ] **Step 6: Verify UI in browser**

Start the dev server (`npm run dev`), navigate to `/attendance`, confirm:
- Manual entry form has a Rate Code dropdown with 5 optgroups
- Attendance table has a Rate column
- Saving a manual entry with a rate code shows the badge in the table

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/attendance/page.tsx
git commit -m "feat(attendance): rate code dropdown and table column"
```

---

## Task 4: Payroll run — aggregate OT pay by rate code bucket

**Files:**
- Modify: `src/app/(app)/payroll/page.tsx`

- [ ] **Step 1: Import OT_RATES**

Add `OT_RATES` to the `ph-payroll` import at the top of `src/app/(app)/payroll/page.tsx`:

```ts
import { computeSemiMonthlyPayroll, OT_RATES, hourlyRate } from "@/lib/ph-payroll";
```

- [ ] **Step 2: Replace the OT aggregation in runPayroll**

In the `runPayroll` server action, replace the existing lines that compute `otHours` and `ndHours`:

```ts
// OLD (remove these 3 lines):
const regularHours = attendance.reduce((sum, a) => sum + Math.min(a.hoursWorked, 8), 0);
const otHours = attendance.reduce((sum, a) => sum + (a.otHours ?? 0), 0);
```

With:

```ts
const daysWorked = attendance.filter((a) => a.hoursWorked > 0).length;
const regularHours = attendance.reduce((sum, a) => sum + Math.min(a.hoursWorked, 8), 0);

const hr = hourlyRate(e.basicMonthlyRate);
let overtimePayIn = 0;
let nightDiffPayIn = 0;
let holidayPayIn   = 0;

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

- [ ] **Step 3: Pass pre-computed buckets to computeSemiMonthlyPayroll**

Update the `computeSemiMonthlyPayroll` call to use the new override fields instead of `otHours`:

```ts
const calc = computeSemiMonthlyPayroll({
  monthlyRate: e.basicMonthlyRate,
  periodStart: start,
  periodEnd: end,
  daysWorked: daysWorked > 0 ? daysWorked : undefined,
  regularHours,
  overtimePayIn,
  nightDiffPayIn,
  holidayPayIn,
  taxableAdjustments: taxableAdj,
  nonTaxableAdjustments: nonTaxableAdj,
});
```

- [ ] **Step 4: Verify payroll run in browser**

Navigate to `/payroll`, click "Run payroll". Confirm:
- Payroll runs without errors
- Employees with no attendance get `basicPay = monthlyRate / 2`
- Add a manual attendance entry with rate code `RH` (2.0×), re-run payroll, check that employee's payslip shows non-zero Holiday Pay

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/payroll/page.tsx
git commit -m "feat(payroll): aggregate OT pay by rate code bucket (R_OT/RH/ND routing)"
```

---

## Task 5: Seed — 8 real employees

**Files:**
- Rewrite: `prisma/seed.ts`

- [ ] **Step 1: Rewrite seed.ts**

Replace the entire contents of `prisma/seed.ts` with:

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeSemiMonthlyPayroll } from "../src/lib/ph-payroll";

const prisma = new PrismaClient();

const EMPLOYEES = [
  {
    number: "MMTSI2021-004",
    firstName: "John Andrew", middleName: "Maglinte", lastName: "Emnase",
    position: "Admin Staff - Sto. Tomas", department: "Admin",
    status: "REGULAR", rate: 20000,
    hire: new Date("2021-06-01"),
  },
  {
    number: "MMTSI2019-002",
    firstName: "Louie", middleName: "Padawan", lastName: "Castillo",
    position: "Accounting Team Leader", department: "Finance",
    status: "REGULAR", rate: 38000,
    hire: new Date("2019-03-15"),
  },
  {
    number: "MMTSI2019-003",
    firstName: "Angela Luz", middleName: "Collantes", lastName: "Veloso",
    position: "Senior Accountant", department: "Finance",
    status: "REGULAR", rate: 32000,
    hire: new Date("2019-08-01"),
  },
  {
    number: "MMTSI2022-006",
    firstName: "Ella Queenly", middleName: "Atienza", lastName: "Domingo",
    position: "Admin Staff - Bauan", department: "Admin",
    status: "REGULAR", rate: 20000,
    hire: new Date("2022-01-10"),
  },
  {
    number: "MMTSI2023-010",
    firstName: "Ailyn", middleName: "Castillo", lastName: "Espanola",
    position: "Admin Staff", department: "Admin",
    status: "REGULAR", rate: 18000,
    hire: new Date("2023-04-03"),
  },
  {
    number: "MMTSI2023-011",
    firstName: "Jay Lloyd", middleName: "Josol", lastName: "Sale",
    position: "Admin Staff - Sto. Tomas", department: "Admin",
    status: "REGULAR", rate: 18000,
    hire: new Date("2023-07-17"),
  },
  {
    number: "MMTSI2024-012",
    firstName: "Reyniel", middleName: "Maglinte", lastName: "Emnase",
    position: "Admin Staff - Part-Time", department: "Admin",
    status: "CONTRACTUAL", rate: 12000,
    hire: new Date("2024-02-05"),
  },
  {
    number: "MMTSI2025-013",
    firstName: "Jane", middleName: "Balba", lastName: "Ocampo",
    position: "Accounting Staff", department: "Finance",
    status: "REGULAR", rate: 22000,
    hire: new Date("2025-01-06"),
  },
] as const;

function emailFor(e: { firstName: string; lastName: string }) {
  const first = e.firstName.toLowerCase().replace(/\s+/g, "");
  const last  = e.lastName.toLowerCase().replace(/\s+/g, "");
  return `${first}.${last}@mmtsi.ph`;
}

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "demo-co" },
    update: {},
    create: { id: "demo-co", name: "MMTSI", tin: "123-456-789-000", address: "Sto. Tomas, Batangas" },
  });

  const password = await bcrypt.hash("demo1234", 10);

  await prisma.user.upsert({
    where: { email: "owner@demo.ph" },
    update: { password, companyId: company.id },
    create: { email: "owner@demo.ph", name: "Admin", password, role: "OWNER", companyId: company.id },
  });

  // Wipe existing data
  await prisma.user.deleteMany({ where: { role: "EMPLOYEE" } });
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.document.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.employee.deleteMany();

  const now = new Date();
  const cutoffs = [
    {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 16),
      end:   new Date(now.getFullYear(), now.getMonth(), 0),
    },
    {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end:   new Date(now.getFullYear(), now.getMonth() - 1, 15),
    },
    now.getDate() <= 15
      ? { start: new Date(now.getFullYear(), now.getMonth(), 1),  end: new Date(now.getFullYear(), now.getMonth(), 15) }
      : { start: new Date(now.getFullYear(), now.getMonth(), 16), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) },
  ];

  const created: { id: string; emp: typeof EMPLOYEES[number] }[] = [];

  for (const emp of EMPLOYEES) {
    const email = emailFor(emp);
    const record = await prisma.employee.create({
      data: {
        companyId:        company.id,
        employeeNumber:   emp.number,
        firstName:        emp.firstName,
        middleName:       emp.middleName,
        lastName:         emp.lastName,
        email,
        dateHired:        emp.hire,
        position:         emp.position,
        department:       emp.department,
        employmentStatus: emp.status,
        basicMonthlyRate: emp.rate,
        tin:              `000-000-000-000`,
        sssNumber:        `00-0000000-0`,
        philHealthNumber: `00-000000000-0`,
        pagIbigNumber:    `0000-0000-0000`,
      },
    });

    created.push({ id: record.id, emp });

    // Payroll history: 3 cutoffs
    for (const { start, end } of cutoffs) {
      const calc = computeSemiMonthlyPayroll({ monthlyRate: emp.rate, periodStart: start, periodEnd: end });
      await prisma.payroll.upsert({
        where: { employeeId_periodStart_periodEnd: { employeeId: record.id, periodStart: start, periodEnd: end } },
        update: { ...calc, status: "RELEASED" },
        create: { employeeId: record.id, periodStart: start, periodEnd: end, status: "RELEASED", ...calc },
      });
    }

    // Portal login for every employee
    await prisma.user.create({
      data: {
        email,
        name:       `${emp.firstName} ${emp.lastName}`,
        password,
        role:       "EMPLOYEE",
        companyId:  company.id,
        employeeId: record.id,
      },
    });
  }

  // Demo loans
  const [emnase, castillo, , , , , , ocampo] = created;
  const loanSeeds = [
    { rec: emnase,  type: "SSS_SALARY",  desc: "SSS salary loan (24 mo)", total: 24000, monthly: 1000 },
    { rec: castillo, type: "PAGIBIG_MPL", desc: "Pag-IBIG multi-purpose loan", total: 30000, monthly: 1250 },
    { rec: ocampo,  type: "CASH_ADVANCE", desc: "Emergency cash advance", total: 8000, monthly: 2000 },
  ];
  for (const ls of loanSeeds) {
    if (!ls.rec) continue;
    await prisma.loan.create({
      data: {
        employeeId:       ls.rec.id,
        companyId:        company.id,
        type:             ls.type,
        description:      ls.desc,
        totalAmount:      ls.total,
        balance:          Math.round(ls.total * 0.6),
        monthlyDeduction: ls.monthly,
        startDate:        new Date(now.getFullYear(), now.getMonth() - 2, 1),
        status:           "ACTIVE",
      },
    });
  }

  // Demo leave requests
  const [e0, e1, e2, , e4, e5] = created;
  const leaveSeeds = [
    { rec: e0, type: "SIL",      daysAgo: 30, days: 2 },
    { rec: e1, type: "SIL",      daysAgo: 45, days: 1 },
    { rec: e2, type: "PATERNITY", daysAgo: 60, days: 3 },
  ];
  for (const lv of leaveSeeds) {
    if (!lv.rec) continue;
    const startDate = new Date(Date.now() - lv.daysAgo * 86400000);
    const endDate   = new Date(+startDate + (lv.days - 1) * 86400000);
    await prisma.leaveRequest.create({
      data: { employeeId: lv.rec.id, leaveType: lv.type, startDate, endDate, days: lv.days, status: "APPROVED" },
    });
  }
  for (const rec of [e4, e5].filter(Boolean)) {
    const startDate = new Date(Date.now() + 7 * 86400000);
    const endDate   = new Date(+startDate + 86400000);
    await prisma.leaveRequest.create({
      data: { employeeId: rec.id, leaveType: "SIL", startDate, endDate, days: 2, status: "PENDING" },
    });
  }

  console.log(`\nSeeded company "${company.name}" with ${EMPLOYEES.length} employees.\n`);
  console.log("=== CREDENTIALS ===");
  console.log("ADMIN:  owner@demo.ph / demo1234");
  console.log("\nEMPLOYEE PORTAL:");
  for (const { emp } of created) {
    console.log(`  ${emailFor(emp)}  /  demo1234`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the seed**

```bash
npx prisma db push && npx tsx prisma/seed.ts
```

Expected: `Seeded company "MMTSI" with 8 employees.` followed by credentials list.

- [ ] **Step 3: Verify in the app**

Start the dev server (`npm run dev`) and confirm:
- Login as `owner@demo.ph / demo1234` → Employees page shows exactly 8 employees with MMTSI IDs
- Login as `johnandrew.emnase@mmtsi.ph / demo1234` → `/my` portal loads with correct name and payslip history
- Payroll page shows 8 employees when "Run payroll" is clicked

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): replace demo employees with 8 real MMTSI employees"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Schema: `otRateCode String?` added (Task 1)
- ✅ 8 real employees with MMTSI IDs and positions (Task 5)
- ✅ All 8 get portal login (Task 5 Step 1 — `emailFor()` + user create loop)
- ✅ Daily rate formula `monthly / 21.75` (Task 2 Step 1)
- ✅ 17-code `OT_RATES` map (Task 2 Step 1)
- ✅ `OT_MULTIPLIERS` backward-compat alias (Task 2 Step 1)
- ✅ Rate Code dropdown in manual attendance entry (Task 3 Step 3)
- ✅ Rate column in attendance table (Task 3 Step 4)
- ✅ `logManual` saves `otRateCode` (Task 3 Step 2)
- ✅ Payroll run routes ND*/RH*/else to nightDiffPay/holidayPay/overtimePay buckets (Task 4 Step 2)
- ✅ `null` otRateCode falls back to R_OT 1.25× (Task 4 Step 2 — `?? "R_OT"`)

**Type consistency check:**
- `OT_RATES` defined in Task 2, imported in Tasks 3 and 4 ✅
- `overtimePayIn / nightDiffPayIn / holidayPayIn` defined in PayrollInput (Task 2 Step 2), used in payroll run call (Task 4 Step 3) ✅
- `hourlyRate()` exported in Task 2 Step 1, imported in Task 4 Step 1 ✅
- `emailFor()` defined and used within seed (Task 5) ✅

**Placeholder scan:** No TBDs, TODOs, or vague instructions found.
