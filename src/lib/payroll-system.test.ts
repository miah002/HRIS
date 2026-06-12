/**
 * System acceptance tests — encodes the operator's stated payroll rules:
 *  1. OT (hours > 8) is paid ONLY when the period's OT Approval is APPROVED.
 *  2. Rest days pay the FULL rest-day multiplier; hours beyond 8 add a higher OT tier.
 *  3. Holidays work the same way (premium for first 8h, higher OT tier beyond 8h).
 *  4. Government-mandated deductions (SSS/PHIC/HDMF) always carry an employer counterpart;
 *     non-mandated lines (WHT, loans) do NOT.
 *  5. Deductions land on the correct cutoff (PHIC+HDMF on 1st, SSS on 2nd) and the
 *     employer counterpart lands on the SAME cutoff as the employee share.
 */
import { describe, it, expect } from "vitest";
import {
  computeAttendancePay,
  computeSemiMonthlyPayroll,
  countUnpaidAbsenceDays,
  phDayKey,
  sssContribution,
  philHealthContribution,
  pagIbigContribution,
  hourlyRate,
  OT_RATES,
  type AttendanceRowLite,
} from "@/lib/ph-payroll";
import { getPHHoliday } from "@/lib/ph-holidays";

const HR = 100; // ₱100/hr — clean numbers
const r2 = (n: number) => Math.round(n * 100) / 100;
const row = (p: Partial<AttendanceRowLite> = {}): AttendanceRowLite => ({
  hoursWorked: 8, otHours: null, ndHours: null, otRateCode: null, ...p,
});

// ── 1. OT gated behind approval ──────────────────────────────────────────────
describe("REQ-1: overtime (>8h) is only paid when OT is approved", () => {
  it("plain 2h OT — paid when approved", () => {
    const r = computeAttendancePay([row({ hoursWorked: 10, otHours: 2 })], HR, true);
    expect(r.overtimePay).toBe(2 * HR * OT_RATES.R_OT); // 250
  });
  it("plain 2h OT — NOT paid when unapproved", () => {
    const r = computeAttendancePay([row({ hoursWorked: 10, otHours: 2 })], HR, false);
    expect(r.overtimePay).toBe(0);
  });
  it("flat night differential (+10% on ND hours) is NOT gated — it is a shift premium, not OT", () => {
    const r = computeAttendancePay([row({ ndHours: 3 })], HR, false);
    expect(r.nightDiffPay).toBe(r2(3 * HR * 0.1)); // 30 — paid even without OT approval
  });
});

// ── 2. Rest day: ENTIRE premium gated behind OT approval; >8h is a higher tier ─
describe("REQ-2: rest-day premium (whole day) requires OT approval", () => {
  it("8h RD approved → 8 × hr × 1.30 (full rate)", () => {
    const r = computeAttendancePay([row({ otRateCode: "RD" })], HR, true);
    expect(r.overtimePay).toBe(8 * HR * OT_RATES.RD); // 1040
  });
  it("8h RD UNAPPROVED → 0 (whole rest-day premium withheld)", () => {
    const r = computeAttendancePay([row({ otRateCode: "RD" })], HR, false);
    expect(r.overtimePay).toBe(0);
  });
  it("10h RD approved → 8h×1.30 + 2h×1.69", () => {
    const r = computeAttendancePay([row({ hoursWorked: 10, otHours: 2, otRateCode: "RD" })], HR, true);
    expect(r.overtimePay).toBe(r2(8 * HR * OT_RATES.RD + 2 * HR * OT_RATES.RD_OT)); // 1378
  });
  it("10h RD unapproved → 0 (both the 8h premium AND the >8h tier withheld)", () => {
    const r = computeAttendancePay([row({ hoursWorked: 10, otHours: 2, otRateCode: "RD" })], HR, false);
    expect(r.overtimePay).toBe(0);
  });
  it("RD_OT multiplier is the rest-day rate compounded (1.30 × 1.30 = 1.69)", () => {
    expect(r2(OT_RATES.RD * 1.3)).toBe(OT_RATES.RD_OT);
  });
});

// ── 3. Holidays: same gating ─────────────────────────────────────────────────
describe("REQ-3: holiday premium (whole day) requires OT approval", () => {
  it("8h Regular Holiday approved → +100% premium above the salary base (×1.00 of hr)", () => {
    const r = computeAttendancePay([row({ otRateCode: "RH" })], HR, true);
    expect(r.holidayPay).toBe(8 * HR * 1.0); // 800 premium (base already in fixed salary)
  });
  it("8h Regular Holiday UNAPPROVED → 0 (premium withheld)", () => {
    const r = computeAttendancePay([row({ otRateCode: "RH" })], HR, false);
    expect(r.holidayPay).toBe(0);
  });
  it("10h Regular Holiday approved → 8h premium + 2h×2.60 OT", () => {
    const r = computeAttendancePay([row({ hoursWorked: 10, otHours: 2, otRateCode: "RH" })], HR, true);
    expect(r.holidayPay).toBe(r2(8 * HR * 1.0 + 2 * HR * OT_RATES.RH_OT)); // 800 + 520 = 1320
  });
  it("10h Regular Holiday unapproved → 0 (whole day withheld)", () => {
    const r = computeAttendancePay([row({ hoursWorked: 10, otHours: 2, otRateCode: "RH" })], HR, false);
    expect(r.holidayPay).toBe(0);
  });
  it("8h Special Holiday approved → +30% premium (×0.30 of hr)", () => {
    const r = computeAttendancePay([row({ otRateCode: "SH" })], HR, true);
    expect(r.holidayPay).toBe(8 * HR * 0.3); // 240
  });
  it("Holiday-on-rest-day (RH_RD) approved pays the FULL ×2.60, not a premium-above-base", () => {
    const r = computeAttendancePay([row({ otRateCode: "RH_RD" })], HR, true);
    expect(r.holidayPay).toBe(8 * HR * OT_RATES.RH_RD); // 2080 — rest day, base not in salary
  });
  it("RH_OT = RH × 1.30 (2.00 × 1.30 = 2.60)", () => {
    expect(r2(OT_RATES.RH * 1.3)).toBe(OT_RATES.RH_OT);
  });
});

// ── 4. Employer counterpart only for government-mandated ─────────────────────
describe("REQ-4: employer counterpart exists for SSS/PHIC/HDMF only", () => {
  const rate = 20000;
  it("SSS has an employer share (ER 10% > EE 5%, both > 0)", () => {
    const s = sssContribution(rate);
    expect(s.employee).toBeGreaterThan(0);
    expect(s.employer).toBeGreaterThan(0);
    expect(s.employer).toBeGreaterThan(s.employee); // by law ER share is larger
  });
  it("PhilHealth employer share equals employee share (50/50)", () => {
    const p = philHealthContribution(rate);
    expect(p.employer).toBe(p.employee);
    expect(p.employee).toBeGreaterThan(0);
  });
  it("Pag-IBIG employer share equals employee share (2%/2%, ₱200 cap)", () => {
    const h = pagIbigContribution(rate);
    expect(h.employer).toBe(h.employee);
    expect(h.employee).toBe(200);
  });
  it("WHT and loans are NOT matched by any employer field in the computed result", () => {
    const c = computeSemiMonthlyPayroll({
      monthlyRate: rate, periodStart: new Date(2026, 5, 26), periodEnd: new Date(2026, 6, 10),
    });
    // No employer counterpart key exists for tax; only the three funds carry ER.
    expect(Object.keys(c)).toContain("sssER");
    expect(Object.keys(c)).not.toContain("withholdingTaxER");
  });
});

// ── 5. Deduction cutoff assignment + ER follows EE cutoff ────────────────────
describe("REQ-5: deductions land on the right cutoff, ER follows EE", () => {
  const rate = 20000;
  const first = computeSemiMonthlyPayroll({
    monthlyRate: rate, periodStart: new Date(2026, 5, 11), periodEnd: new Date(2026, 5, 25),
  });
  const second = computeSemiMonthlyPayroll({
    monthlyRate: rate, periodStart: new Date(2026, 5, 26), periodEnd: new Date(2026, 6, 10),
  });

  it("1st cutoff (11–25): PHIC + HDMF deducted, SSS = 0", () => {
    expect(first.philHealthEE).toBeGreaterThan(0);
    expect(first.pagIbigEE).toBeGreaterThan(0);
    expect(first.sssEE).toBe(0);
  });
  it("1st cutoff: employer PHIC + HDMF present, employer SSS = 0", () => {
    expect(first.philHealthER).toBeGreaterThan(0);
    expect(first.pagIbigER).toBeGreaterThan(0);
    expect(first.sssER).toBe(0);
  });
  it("2nd cutoff (26–10): SSS deducted, PHIC + HDMF = 0", () => {
    expect(second.sssEE).toBeGreaterThan(0);
    expect(second.philHealthEE).toBe(0);
    expect(second.pagIbigEE).toBe(0);
  });
  it("2nd cutoff: employer SSS present, employer PHIC + HDMF = 0", () => {
    expect(second.sssER).toBeGreaterThan(0);
    expect(second.philHealthER).toBe(0);
    expect(second.pagIbigER).toBe(0);
  });
  it("WHT is split every cutoff (monthly ÷ 2), independent of fund assignment", () => {
    expect(first.withholdingTax).toBeGreaterThanOrEqual(0);
    expect(second.withholdingTax).toBe(first.withholdingTax);
  });
});

// ── 7. Holiday & night-diff pay belong in the taxable base ───────────────────
describe("REQ-7: holiday & night-diff pay are part of the taxable (WHT) base", () => {
  const base = {
    monthlyRate: 40000,
    periodStart: new Date(2026, 5, 26), periodEnd: new Date(2026, 6, 10),
    isFirstCutoff: false,
  } as const;
  const noPrem      = computeSemiMonthlyPayroll({ ...base });
  const withHoliday = computeSemiMonthlyPayroll({ ...base, holidayPayIn: 2000 });
  const withND      = computeSemiMonthlyPayroll({ ...base, nightDiffPayIn: 2000 });

  it("holiday pay raises withholding tax", () => {
    expect(withHoliday.withholdingTax).toBeGreaterThan(noPrem.withholdingTax);
  });
  it("night-diff pay raises withholding tax", () => {
    expect(withND.withholdingTax).toBeGreaterThan(noPrem.withholdingTax);
  });
  it("holiday and ND add to the base identically (₱2,000/cutoff → +₱400 WHT at the 20% bracket)", () => {
    expect(withHoliday.withholdingTax).toBe(withND.withholdingTax);
    expect(r2(withHoliday.withholdingTax - noPrem.withholdingTax)).toBe(400);
  });
});

// ── 8. Absence detection (unpaid days) ───────────────────────────────────────
describe("REQ-8: unpaid absences are counted on expected workdays only", () => {
  // Jun 15–19 2026 = Mon–Fri, no holidays.
  const start = new Date(2026, 5, 15), end = new Date(2026, 5, 19);
  const keys = (...days: number[]) => new Set(days.map((d) => phDayKey(new Date(2026, 5, d))));
  const NONE = new Set<string>();

  it("present all 5 weekdays → 0 absences", () => {
    expect(countUnpaidAbsenceDays({ periodStart: start, periodEnd: end, presentDays: keys(15, 16, 17, 18, 19), paidLeaveDays: NONE })).toBe(0);
  });
  it("present none → 5 absences (full Mon–Fri)", () => {
    expect(countUnpaidAbsenceDays({ periodStart: start, periodEnd: end, presentDays: NONE, paidLeaveDays: NONE })).toBe(5);
  });
  it("present 3, no leave → 2 absences", () => {
    expect(countUnpaidAbsenceDays({ periodStart: start, periodEnd: end, presentDays: keys(15, 16, 17), paidLeaveDays: NONE })).toBe(2);
  });
  it("PAID leave covers the 2 missing days → 0 absences", () => {
    expect(countUnpaidAbsenceDays({ periodStart: start, periodEnd: end, presentDays: keys(15, 16, 17), paidLeaveDays: keys(18, 19) })).toBe(2 - 2);
  });
  it("unpaid leave (not in paidLeaveDays) still counts as absence", () => {
    // present 3, one paid-leave day (18), day 19 unpaid → 1 absence
    expect(countUnpaidAbsenceDays({ periodStart: start, periodEnd: end, presentDays: keys(15, 16, 17), paidLeaveDays: keys(18) })).toBe(1);
  });
  it("weekend-only span → 0 absences (rest days never count)", () => {
    expect(countUnpaidAbsenceDays({ periodStart: new Date(2026, 5, 13), periodEnd: new Date(2026, 5, 14), presentDays: NONE, paidLeaveDays: NONE })).toBe(0);
  });
  it("Jun 11–25 absent all → 10 (excludes weekends AND Jun 12 Independence Day RH)", () => {
    const n = countUnpaidAbsenceDays({
      periodStart: new Date(2026, 5, 11), periodEnd: new Date(2026, 5, 25),
      presentDays: NONE, paidLeaveDays: NONE,
      isHoliday: (d) => getPHHoliday(d) !== null,
    });
    expect(n).toBe(10); // 11,15,16,17,18,19,22,23,24,25 (Jun 12 RH excluded)
  });
});

// ── 6. End-to-end net pay reconciliation (gross − deductions = net) ──────────
describe("REQ-6: a full cutoff reconciles gross − deductions = net", () => {
  it("20k employee, 2nd cutoff, no attendance → fixed half-month minus SSS+WHT", () => {
    const c = computeSemiMonthlyPayroll({
      monthlyRate: 20000, periodStart: new Date(2026, 5, 26), periodEnd: new Date(2026, 6, 10),
    });
    expect(c.basicPay).toBe(10000);
    expect(c.grossPay).toBe(10000);
    const expectedDeductions = r2(c.sssEE + c.philHealthEE + c.pagIbigEE + c.withholdingTax);
    expect(c.totalDeductions).toBe(expectedDeductions);
    expect(c.netPay).toBe(r2(c.grossPay - c.totalDeductions));
  });

  // Full pipeline composition — mirrors runPayroll(): attendance → premium pay →
  // semi-monthly calc, checked against hand-computed numbers (independent of the code).
  it("E2E: ₱21,750 employee, 2nd cutoff, RD 10h + RH 8h, OT APPROVED", () => {
    const monthlyRate = 21750;          // → hr = 21750 / 21.75 / 8 = ₱125.00
    const hr = hourlyRate(monthlyRate);
    expect(hr).toBe(125);

    const rows: AttendanceRowLite[] = [
      row({ hoursWorked: 10, otHours: 2, otRateCode: "RD" }), // rest day + 2h OT
      row({ hoursWorked: 8,  otHours: 0, otRateCode: "RH" }), // regular holiday
    ];
    const att = computeAttendancePay(rows, hr, /* approved */ true);

    // Hand math:
    //   RD: 8×125×1.30 + 2×125×1.69 = 1300 + 422.5 = 1722.50  (overtime bucket)
    //   RH: 8×125×1.00            = 1000.00                  (holiday bucket)
    expect(att.overtimePay).toBe(1722.5);
    expect(att.holidayPay).toBe(1000);

    const calc = computeSemiMonthlyPayroll({
      monthlyRate,
      periodStart: new Date(2026, 5, 26), periodEnd: new Date(2026, 6, 10), // 2nd cutoff → SSS
      isFirstCutoff: false,
      sssEarningsMonthly: monthlyRate + att.overtimePay * 2, // 21750 + 3445 = 25195 → MSC 25000
      overtimePayIn: att.overtimePay,
      holidayPayIn: att.holidayPay,
      nightDiffPayIn: att.nightDiffPay,
    });

    expect(calc.basicPay).toBe(10875);                 // 21750 / 2
    expect(calc.grossPay).toBe(13597.5);               // 10875 + 1722.5 + 1000
    expect(calc.sssEE).toBe(1250);                     // MSC 25000 × 5% (2025/26 employee rate)
    expect(calc.sssER).toBe(2500);                     // MSC 25000 × 10% (gov-mandated ER)
    expect(calc.philHealthEE).toBe(0);                 // not on 2nd cutoff
    expect(calc.pagIbigEE).toBe(0);                    // not on 2nd cutoff
    // WHT: taxable = (basic 10875 + OT 1722.5 + holiday 1000) × 2 − monthlyStatutory(1250+543.75+200)
    //      = 27195 − 1993.75 = 25201.25 → (25201.25−20833)×15% = 655.24/mo → 327.62/cutoff
    //      Holiday pay IS in the taxable base (taxable for regular employees).
    expect(calc.withholdingTax).toBe(327.62);
    expect(calc.totalDeductions).toBe(1577.62);        // SSS 1250 + WHT 327.62
    expect(calc.netPay).toBe(12019.88);                // 13597.5 − 1577.62
  });

  it("payslip reconstruction uses the same engine → breakdown sums to buckets", () => {
    const hr = hourlyRate(20000);
    const rows: AttendanceRowLite[] = [
      row({ otRateCode: "RD" }),                       // rest day full rate
      row({ hoursWorked: 10, otHours: 2, otRateCode: "RH" }), // holiday + OT
      row({ hoursWorked: 10, otHours: 2 }),            // plain OT
      row({ ndHours: 3 }),                             // night diff
    ];
    const pay = computeAttendancePay(rows, hr, true);
    const breakdownSum = r2(pay.breakdown.reduce((s, b) => s + b.regPay + b.otPay, 0));
    // breakdown excludes the standalone ND +10% line, so add it back for the identity
    const ndOnly = r2(3 * hr * 0.1);
    expect(r2(breakdownSum + ndOnly)).toBe(r2(pay.overtimePay + pay.nightDiffPay + pay.holidayPay));
  });
});
