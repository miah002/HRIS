/**
 * Philippine payroll computation library.
 *
 * Compliance references:
 *  - Labor Code of the Philippines (PD 442, as amended) — OT, night differential, holiday premiums
 *  - SSS Circular 2023-006 / RA 11199 — contribution table (effective 2025 schedule, used as 2026 baseline)
 *  - RA 11223 (Universal Health Care Act) — PhilHealth premium rate (5% in 2024+, capped salary floor/ceiling)
 *  - HDMF Circular 460 — Pag-IBIG 2% EE / 2% ER, MSC ceiling ₱10,000 → fixed ₱200 EE/ER
 *  - TRAIN Law (RA 10963) — revised withholding tax tables (effective Jan 1, 2023 onwards)
 *
 * Cutoff deduction assignment (client preference):
 *  - 1st cutoff (1–15): PHIC + HDMF full monthly amounts
 *  - 2nd cutoff (16–end): SSS full monthly amount
 *  - WHT: always monthly amount ÷ 2 per cutoff
 *
 * IMPORTANT: Contribution tables move periodically. Values here are accurate as of build time;
 * production deployments should expose these as DB-driven config so finance teams can update
 * without code changes. Comments below tag each numeric source for auditability.
 */

// ---------- SSS contributions (2025 schedule, ₱5,000–₱35,000 MSC, ₱500 brackets) ----------
// 2025/2026 rate: 15% total = 5% EE / 10% ER (EC is a small employer-only fixed amount,
// tracked separately, not modeled here). The employer share is by law larger than the
// employee's — SSS is NOT a 50/50 match (unlike PhilHealth and Pag-IBIG).
const SSS_EE_RATE = 0.05;
const SSS_ER_RATE = 0.1;
const SSS_MSC_MIN = 5000;   // 2025 floor
const SSS_MSC_MAX = 35000;  // 2025 ceiling
const SSS_MSC_STEP = 500;

export function sssContribution(monthlyEarnings: number) {
  // Snap earnings to the NEAREST ₱500 MSC bracket (matches the official SSS table, whose
  // ranges are centred on each MSC, e.g. 25,250–25,749.99 → 25,500), within floor/ceiling.
  const msc = Math.max(
    SSS_MSC_MIN,
    Math.min(SSS_MSC_MAX, Math.round(monthlyEarnings / SSS_MSC_STEP) * SSS_MSC_STEP)
  );
  return {
    msc,
    employee: round2(msc * SSS_EE_RATE),
    employer: round2(msc * SSS_ER_RATE),
  };
}

// ---------- PhilHealth (2024+: 5% split 50/50, floor ₱10k, ceiling ₱100k) ----------
const PHIC_RATE = 0.05;
const PHIC_FLOOR = 10000;
const PHIC_CEIL = 100000;

export function philHealthContribution(monthlyRate: number) {
  const base = Math.max(PHIC_FLOOR, Math.min(PHIC_CEIL, monthlyRate));
  const total = base * PHIC_RATE;
  const half = round2(total / 2);
  return { employee: half, employer: half };
}

// ---------- Pag-IBIG (HDMF): 2% EE / 2% ER, capped at ₱10,000 MSC → ₱200 fixed for salary ≥ ₱10k ----------
const HDMF_RATE = 0.02;
const HDMF_CAP = 10000;

export function pagIbigContribution(monthlyRate: number) {
  const base = Math.min(HDMF_CAP, monthlyRate);
  const ee = round2(base * HDMF_RATE);
  return { employee: ee, employer: ee };
}

// ---------- BIR Withholding Tax — TRAIN Law (effective Jan 1, 2023+) ----------
// Annual brackets translated to monthly basis. Net-of-statutory-contributions taxable income.
// Source: BIR RR 11-2018, RR 8-2018 revised table.
const MONTHLY_TAX_BRACKETS = [
  { upTo: 20833,    base: 0,        rate: 0,    over: 0 },
  { upTo: 33333,    base: 0,        rate: 0.15, over: 20833 },
  { upTo: 66667,    base: 1875,     rate: 0.20, over: 33333 },
  { upTo: 166667,   base: 8541.80,  rate: 0.25, over: 66667 },
  { upTo: 666667,   base: 33541.80, rate: 0.30, over: 166667 },
  { upTo: Infinity, base: 183541.80, rate: 0.35, over: 666667 },
];

export function withholdingTaxMonthly(taxableMonthlyIncome: number) {
  if (taxableMonthlyIncome <= 20833) return 0;
  const bracket = MONTHLY_TAX_BRACKETS.find((b) => taxableMonthlyIncome <= b.upTo)!;
  return round2(bracket.base + (taxableMonthlyIncome - bracket.over) * bracket.rate);
}

// ---------- Overtime / Night differential premiums (Labor Code Art. 87, 86) ----------
// Full DOLE rate matrix keyed by attendance rate code.
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

// ---------- Attendance → premium pay (single source of truth) ----------
//
// The fixed half-month basic (monthlyRate / 2) already pays 100% for every
// REGULAR WORKDAY in the cutoff. Therefore:
//   - Holiday on a workday (RH / SH, no "RD"): base is already in the salary,
//     so working it adds only the PREMIUM above 100% (REG_PREMIUM).
//   - Rest day (any code containing "RD"): NOT a regular workday, so the fixed
//     salary pays 0 for it — working it pays the FULL DOLE multiplier (OT_RATES).
//
// OT-approval gating (operator rule): working a rest day or a holiday IS
// premium ("OT") work, so the ENTIRE premium — both the first-8h portion and
// the hours-beyond-8 tier — is withheld until the period's OT Approval is
// APPROVED. Plain workday OT (>8h, no rate code) is likewise gated. The only
// premium paid regardless of approval is the flat night-differential (+10% on
// ND hours), which is a shift premium, not overtime.

// Premium ABOVE the 100% base already covered by the fixed salary, keyed by base code.
const REG_PREMIUM: Record<string, number> = {
  RD: 0.30,        // rest day — full handling uses OT_RATES, not this; kept for completeness
  SH: 0.30,        // special holiday on a workday: +30%
  SH_RD: 0.50,
  RH: 1.00,        // regular holiday on a workday: +100% (→ 200% total)
  RH_RD: 1.60,
};

export interface AttendanceRowLite {
  hoursWorked: number;
  otHours: number | null;
  ndHours: number | null;
  otRateCode: string | null;
}

export interface AttendancePay {
  overtimePay: number;
  nightDiffPay: number;
  holidayPay: number;
  /** Per-code line items so payslips reconcile with the stored totals. */
  breakdown: { code: string; regHrs: number; regPay: number; otHrs: number; otPay: number }[];
}

/**
 * Compute premium/OT/ND pay from a set of attendance rows for one employee+period.
 * Used by runPayroll (to store), the payroll preview card, and the payslip (to display)
 * so the numbers always reconcile.
 *
 * @param otApproved  when false, hours beyond 8 (true OT) are not paid; premium
 *                    pay for the first 8h of premium days is still counted.
 */
export function computeAttendancePay(
  rows: AttendanceRowLite[],
  hr: number,
  otApproved: boolean,
): AttendancePay {
  let overtimePay = 0;
  let nightDiffPay = 0;
  let holidayPay = 0;
  const breakdown: AttendancePay["breakdown"] = [];

  for (const row of rows) {
    const regHrs = Math.min(row.hoursWorked, 8);
    const otHrs  = otApproved ? (row.otHours ?? 0) : 0;
    const ndHrs  = row.ndHours ?? 0;
    const code   = row.otRateCode;

    if (!code) {
      // Plain workday OT (no special rate code): only the >8h portion is premium.
      const otPay = otHrs > 0 ? round2(otHrs * hr * OT_RATES.R_OT) : 0;
      if (otPay > 0) {
        overtimePay += otPay;
        breakdown.push({ code: "R_OT", regHrs: 0, regPay: 0, otHrs, otPay });
      }
    } else {
      const base = code.replace(/_OT$/, "");
      const isRestDay = code.includes("RD");
      const isHoliday = base.startsWith("RH") || base.startsWith("SH");

      // Rest-day / holiday work is premium ("OT") work: the whole day's premium
      // (first-8h portion AND the >8h tier) is gated behind OT approval. When
      // not approved, this row pays nothing.
      const premiumGated = isRestDay || isHoliday;
      const payPremium = otApproved || !premiumGated;

      // Regular hours: rest day pays the FULL multiplier (not in fixed salary);
      // holiday-on-a-workday pays only the premium above the salary base.
      const regMult = isRestDay ? (OT_RATES[base] ?? 1) : (REG_PREMIUM[base] ?? 0);
      const regPay  = payPremium ? round2(regMult * regHrs * hr) : 0;

      // Overtime hours (>8) always use the full _OT multiplier for the code.
      // otHrs is already 0 when OT is unapproved, so otPay is gated too.
      const otMult = OT_RATES[base + "_OT"] ?? OT_RATES[base] ?? OT_RATES.R_OT;
      const otPay  = otHrs > 0 ? round2(otHrs * hr * otMult) : 0;

      const total = round2(regPay + otPay);
      if (base.startsWith("RH") || base.startsWith("SH")) holidayPay   += total;
      else if (base.startsWith("ND"))                     nightDiffPay += total;
      else                                                overtimePay  += total;

      if (total > 0) breakdown.push({ code, regHrs, regPay, otHrs, otPay });
    }

    // Night-differential premium: flat +10% on ND hours (independent of code).
    if (ndHrs > 0) nightDiffPay += round2(ndHrs * hr * OT_MULTIPLIERS.ndPremium);
  }

  return {
    overtimePay: round2(overtimePay),
    nightDiffPay: round2(nightDiffPay),
    holidayPay: round2(holidayPay),
    breakdown,
  };
}

// ---------- Late / undertime computation ----------
// Uses hoursWorked as authoritative figure; splits shortfall into late (from timeIn) and undertime.
export function lateUndertimeMinutes(
  hoursWorked: number,
  timeIn: Date | null | undefined,
  gracePeriodMinutes = 5,
) {
  const SCHEDULE_START = 8 * 60; // 08:00 in minutes from midnight
  const SCHEDULED_MINUTES = 480; // 8-hour workday

  let lateMin = 0;
  if (timeIn) {
    const t = new Date(timeIn);
    const tinMin = t.getHours() * 60 + t.getMinutes();
    lateMin = Math.max(0, tinMin - SCHEDULE_START - gracePeriodMinutes);
  }

  const workedMin = hoursWorked * 60;
  const shortageMin = Math.max(0, SCHEDULED_MINUTES - workedMin);
  const undertimeMin = Math.max(0, shortageMin - lateMin);

  return { lateMinutes: lateMin, undertimeMinutes: undertimeMin };
}

// ---------- Absence detection ----------
//
// Fixed semi-monthly pay always credits a full half-month. Absences only bite
// for TIMEKEPT employees (the caller passes presentDays derived from actual
// attendance). An expected workday (Mon–Fri, excluding holidays which are paid
// or observed when unworked) on which the employee neither rendered hours nor
// was on PAID leave is an unpaid absence. This captures BOTH approved unpaid
// leave and pure no-call/no-show days in one figure, with no double counting.

/** Local calendar day-key (YYYY-MM-DD) — matches how attendance/cutoff dates are built. */
export function phDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface AbsenceInput {
  periodStart: Date;
  periodEnd: Date;
  /** Day-keys (phDayKey) on which the employee rendered hours. */
  presentDays: Set<string>;
  /** Day-keys covered by APPROVED with-pay leave — never deducted. */
  paidLeaveDays: Set<string>;
  /** True when the date is a holiday (RH/SH) — paid or observed when unworked. */
  isHoliday?: (d: Date) => boolean;
}

/** Count unpaid-absence workdays in the period (see section comment above). */
export function countUnpaidAbsenceDays(i: AbsenceInput): number {
  const isHoliday = i.isHoliday ?? (() => false);
  let count = 0;
  const d = new Date(i.periodStart.getFullYear(), i.periodStart.getMonth(), i.periodStart.getDate());
  const end = new Date(i.periodEnd.getFullYear(), i.periodEnd.getMonth(), i.periodEnd.getDate()).getTime();
  while (d.getTime() <= end) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5 && !isHoliday(d)) {            // Mon–Fri, not a holiday
      const key = phDayKey(d);
      if (!i.presentDays.has(key) && !i.paidLeaveDays.has(key)) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ---------- Semi-monthly payroll (cutoffs 1–15 and 16–end) ----------
//
// Deduction cutoff assignment (client preference):
//   1st cutoff (day ≤ 15 = isFirstCutoff true):  PHIC + HDMF full
//   2nd cutoff (day > 15 = isFirstCutoff false):  SSS full
//   WHT: always monthly WHT ÷ 2 regardless of cutoff
//
// SSS MSC basis: sssEarningsMonthly (basic + OT × 2 + de minimis × 2 if provided)
// otherwise falls back to monthlyRate.
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
  // Cutoff and SSS basis
  isFirstCutoff?: boolean;       // true = 1–15 (PHIC+HDMF), false = 16–end (SSS). Auto-derived from periodStart if omitted.
  sssEarningsMonthly?: number;   // total monthly earnings for SSS MSC (basic + OT + de minimis projection)
  // Late / undertime (pre-computed from attendance)
  lateMinutesIn?: number;
  lateDeductionIn?: number;
  undertimeMinutesIn?: number;
  undertimeDeductionIn?: number;
  // HDMF MP2 voluntary savings (semi-monthly amount)
  hdmfMp2In?: number;
}

export function computeSemiMonthlyPayroll(i: PayrollInput) {
  const hr = hourlyRate(i.monthlyRate);

  // Fixed semi-monthly: always pay half-month rate. daysWorked is informational only.
  const basicPay = round2(i.monthlyRate / 2);

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

  // Determine cutoff type: 1st (PHIC+HDMF) vs 2nd (SSS)
  const isFirstCutoff = i.isFirstCutoff ?? (i.periodStart.getDate() === 11);

  // SSS MSC basis: total monthly earnings (basic + OT × 2 + non-taxable × 2) if provided
  const sssEarnings = i.sssEarningsMonthly ?? i.monthlyRate;
  const sss  = sssContribution(sssEarnings);
  const phic = philHealthContribution(i.monthlyRate);
  const hdmf = pagIbigContribution(i.monthlyRate);

  // Assign statutory deductions to the appropriate cutoff (full amount, not split)
  const sssEE  = isFirstCutoff ? 0 : round2(sss.employee);
  const phicEE = isFirstCutoff ? round2(phic.employee) : 0;
  const hdmfEE = isFirstCutoff ? round2(hdmf.employee) : 0;

  const sssERVal  = isFirstCutoff ? 0 : round2(sss.employer);
  const phicERVal = isFirstCutoff ? round2(phic.employer) : 0;
  const hdmfERVal = isFirstCutoff ? round2(hdmf.employer) : 0;

  // WHT always monthly ÷ 2 (use full statutory as monthly deduction basis for tax computation).
  // Taxable compensation includes basic + ALL premium pay (OT, holiday, night diff) plus
  // taxable adjustments. Holiday/OT/ND premiums are taxable for regular employees (only
  // statutory-minimum-wage earners are exempt). De minimis / non-taxable adjustments are excluded.
  const monthlyStatutory = sss.employee + phic.employee + hdmf.employee;
  const taxableSemi = basicPay + otPay + ndPay + holidayPay + taxableAdj;
  const taxableMonthly = Math.max(0, taxableSemi * 2 - monthlyStatutory);
  const monthlyWHT = withholdingTaxMonthly(taxableMonthly);
  const whtSemi = round2(monthlyWHT / 2);

  // Late / undertime
  const lateMinutes = i.lateMinutesIn ?? 0;
  const lateDeduction = i.lateDeductionIn ?? 0;
  const undertimeMinutes = i.undertimeMinutesIn ?? 0;
  const undertimeDeduction = i.undertimeDeductionIn ?? 0;

  // HDMF MP2 voluntary savings
  const hdmfMp2 = i.hdmfMp2In ?? 0;

  const otherDed = i.otherDeductions ?? 0;
  const totalDeductions = round2(sssEE + phicEE + hdmfEE + whtSemi + lateDeduction + undertimeDeduction + hdmfMp2 + otherDed);
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
    lateMinutes,
    lateDeduction,
    undertimeMinutes,
    undertimeDeduction,
    hdmfMp2,
    otherDeductions: otherDed,
    totalDeductions,
    netPay,
    sssER: sssERVal,
    philHealthER: phicERVal,
    pagIbigER: hdmfERVal,
  };
}

// ---------- 13th month pay (PD 851) — basic salary / 12, due Dec 24 ----------
export function thirteenthMonthAccrual(monthlyBasic: number, monthsWorked: number) {
  return round2((monthlyBasic * monthsWorked) / 12);
}

// ---------- Statutory leave entitlements ----------
export const STATUTORY_LEAVE = {
  VL:        { days: 15,  ref: "Company policy — Vacation Leave" },
  SL:        { days: 15,  ref: "Company policy — Sick Leave" },
  MATERNITY: { days: 105, ref: "RA 11210 (Expanded Maternity Leave; +15 if solo parent)" },
  PATERNITY: { days: 7,   ref: "RA 8187 (for first 4 deliveries of legitimate spouse)" },
} as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
