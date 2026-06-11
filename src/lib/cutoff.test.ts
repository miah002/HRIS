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
