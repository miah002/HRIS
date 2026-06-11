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

/**
 * Single source of truth for cutoff type:
 *   1st cutoff (11–25) collects PHIC + HDMF; 2nd cutoff (26–10) collects SSS.
 * Periods always start on day 11 or 26, so the start day fully determines the type.
 * Replaces the divergent `=== 11` / `<= 15` / `getUTCDate()` checks scattered across files.
 */
export function isFirstCutoff(start: Date): boolean {
  return start.getDate() === 11;
}
