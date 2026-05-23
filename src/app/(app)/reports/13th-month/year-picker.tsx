"use client";

import { useRouter } from "next/navigation";

export function YearPicker({ year }: { year: number }) {
  const router = useRouter();
  const now = new Date();
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  return (
    <select
      value={year}
      onChange={(e) => router.push(`/reports/13th-month?year=${e.target.value}`)}
      className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
    >
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}
