import { describe, it, expect } from "vitest";
import { computeAttendancePay, OT_RATES } from "@/lib/ph-payroll";
import type { AttendanceRowLite } from "@/lib/ph-payroll";

const HR = 100; // ₱100/hr — clean numbers, no rounding noise

const row = (partial: Partial<AttendanceRowLite> = {}): AttendanceRowLite => ({
  hoursWorked: 8,
  otHours: null,
  ndHours: null,
  otRateCode: null,
  ...partial,
});

describe("computeAttendancePay — rest day full rate", () => {
  it("8h RD → overtimePay = 8 × hr × 1.30 (full rate, NOT 30% premium)", () => {
    const result = computeAttendancePay([row({ otRateCode: "RD" })], HR, false);
    expect(result.overtimePay).toBe(8 * HR * OT_RATES.RD); // 1040, not 240
    expect(result.holidayPay).toBe(0);
    expect(result.nightDiffPay).toBe(0);
  });

  it("10h RD + approved → 8h×1.30 + 2h×1.69", () => {
    const result = computeAttendancePay(
      [row({ hoursWorked: 10, otHours: 2, otRateCode: "RD" })],
      HR,
      true,
    );
    const expected = Math.round((8 * HR * OT_RATES.RD + 2 * HR * OT_RATES.RD_OT) * 100) / 100;
    expect(result.overtimePay).toBe(expected); // 1040 + 338 = 1378
  });

  it("10h RD + unapproved → 8h×1.30 only (OT gated)", () => {
    const result = computeAttendancePay(
      [row({ hoursWorked: 10, otHours: 2, otRateCode: "RD" })],
      HR,
      false,
    );
    expect(result.overtimePay).toBe(8 * HR * OT_RATES.RD); // 1040
  });
});

describe("computeAttendancePay — regular holiday on weekday (RH)", () => {
  it("8h RH → holidayPay = 8 × hr × 1.00 (premium only; base already in salary)", () => {
    const result = computeAttendancePay([row({ otRateCode: "RH" })], HR, false);
    expect(result.holidayPay).toBe(8 * HR * 1.0); // 800
    expect(result.overtimePay).toBe(0);
  });

  it("8h SH → holidayPay = 8 × hr × 0.30", () => {
    const result = computeAttendancePay([row({ otRateCode: "SH" })], HR, false);
    expect(result.holidayPay).toBe(8 * HR * 0.3); // 240
    expect(result.overtimePay).toBe(0);
  });
});

describe("computeAttendancePay — plain workday OT (no rate code)", () => {
  it("8h plain, no OT → all zeros", () => {
    const result = computeAttendancePay([row()], HR, true);
    expect(result.overtimePay).toBe(0);
    expect(result.holidayPay).toBe(0);
    expect(result.nightDiffPay).toBe(0);
  });

  it("2h plain OT, approved → 2 × hr × 1.25", () => {
    const result = computeAttendancePay(
      [row({ hoursWorked: 10, otHours: 2 })],
      HR,
      true,
    );
    expect(result.overtimePay).toBe(2 * HR * OT_RATES.R_OT); // 250
  });

  it("2h plain OT, unapproved → 0", () => {
    const result = computeAttendancePay(
      [row({ hoursWorked: 10, otHours: 2 })],
      HR,
      false,
    );
    expect(result.overtimePay).toBe(0);
  });
});

describe("computeAttendancePay — breakdown reconciliation", () => {
  it("sum of breakdown regPay+otPay equals overtimePay+nightDiffPay+holidayPay", () => {
    const rows: AttendanceRowLite[] = [
      row({ otRateCode: "RD" }),
      row({ otRateCode: "RH" }),
      row({ hoursWorked: 10, otHours: 2 }), // plain OT
    ];
    const result = computeAttendancePay(rows, HR, true);
    const breakdownSum =
      Math.round(
        result.breakdown.reduce((s, b) => s + b.regPay + b.otPay, 0) * 100,
      ) / 100;
    const bucketSum = result.overtimePay + result.nightDiffPay + result.holidayPay;
    expect(breakdownSum).toBe(bucketSum);
  });

  it("empty rows → all zeros, empty breakdown", () => {
    const result = computeAttendancePay([], HR, true);
    expect(result.overtimePay).toBe(0);
    expect(result.nightDiffPay).toBe(0);
    expect(result.holidayPay).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });
});
