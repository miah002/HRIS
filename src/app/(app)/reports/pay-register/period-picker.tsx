"use client";

import { useRouter } from "next/navigation";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function PeriodPicker({ year, month, half }: { year: number; month: number; half: number }) {
  const router = useRouter();
  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear()];

  function navigate(y: number, m: number, h: number) {
    router.push(`/reports/pay-register?year=${y}&month=${m}&half=${h}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={year}
        onChange={(e) => navigate(Number(e.target.value), month, half)}
        className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select
        value={month}
        onChange={(e) => navigate(year, Number(e.target.value), half)}
        className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      >
        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <div className="flex rounded-[var(--radius-sm)] border border-[var(--border)] overflow-hidden text-sm">
        {[1, 2].map((h) => (
          <button
            key={h}
            onClick={() => navigate(year, month, h)}
            className={`px-3 py-1 transition-colors ${half === h ? "bg-[var(--brand)] text-white" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--neutral-bg)]"}`}
          >
            {h === 1 ? "1–15" : "16–end"}
          </button>
        ))}
      </div>
    </div>
  );
}
