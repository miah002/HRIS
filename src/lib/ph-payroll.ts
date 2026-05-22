/**
 * Philippine payroll computation library.
 *
 * Compliance references:
 *  - Labor Code of the Philippines (PD 442, as amended) — OT, night differential, holiday premiums
 *  - SSS Circular 2023-006 / RA 11199 — contribution table (effective 2025 schedule, used as 2026 baseline)
 *  - RA 11223 (Universal Health Care Act) — PhilHealth premium rate (5% in 2024+, capped salary floor/ceiling)
 *  - HDMF Circular 460 — Pag-IBIG 2% EE / 2% ER, MSC ceiling ₱10,000
 *  - TRAIN Law (RA 10963) — revised withholding tax tables (effective Jan 1, 2023 onwards)
 *
 * IMPORTANT: Contribution tables move periodically. Values here are accurate as of build time;
 * production deployments should expose these as DB-driven config so finance teams can update
 * without code changes. Comments below tag each numeric source for auditability.
 */

// ---------- SSS contributions (2025 schedule, ₱1,000–₱35,000 MSC, ₱500 brackets) ----------
// Rate: 15% total (4.5% EE / 10% ER + 1% EC employer-only). We compute EE and ER shares.
const SSS_EE_RATE = 0.045;
const SSS_ER_RATE = 0.1;
const SSS_MSC_MIN = 5000;   // 2025 floor
const SSS_MSC_MAX = 35000;  // 2025 ceiling
const SSS_MSC_STEP = 500;

export function sssContribution(monthlyRate: number) {
  // Round monthly rate to nearest MSC bracket (round down to step within floor/ceiling).
  const msc = Math.max(
    SSS_MSC_MIN,
    Math.min(SSS_MSC_MAX, Math.floor(monthlyRate / SSS_MSC_STEP) * SSS_MSC_STEP)
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

// ---------- Pag-IBIG (HDMF): 2% EE / 2% ER, capped at ₱10,000 MSC ----------
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

// ---------- Semi-monthly payroll (cutoffs 1–15 and 16–end) ----------
// Mandatory deductions are MONTHLY but commonly split evenly across two cutoffs.
// We split SSS/PhilHealth/Pag-IBIG/WHT in half for each semi-monthly run.
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

// ---------- 13th month pay (PD 851) — basic salary / 12, due Dec 24 ----------
export function thirteenthMonthAccrual(monthlyBasic: number, monthsWorked: number) {
  return round2((monthlyBasic * monthsWorked) / 12);
}

// ---------- Statutory leave entitlements ----------
export const STATUTORY_LEAVE = {
  SIL: { days: 5, ref: "Art. 95, Labor Code (after 1 year of service)" },
  MATERNITY: { days: 105, ref: "RA 11210 (Expanded Maternity Leave; +15 if solo parent)" },
  PATERNITY: { days: 7, ref: "RA 8187 (for first 4 deliveries of legitimate spouse)" },
  SOLO_PARENT: { days: 7, ref: "RA 11861 (Expanded Solo Parents Welfare Act)" },
  MAGNA_CARTA: { days: 60, ref: "RA 9710 (Special Leave for Women, post-surgery)" },
  VAWC: { days: 10, ref: "RA 9262 (Violence Against Women and Children)" },
} as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
