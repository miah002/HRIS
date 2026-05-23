"use client";

import { useRouter } from "next/navigation";

export function YearNav({ year }: { year: number }) {
  const now = new Date();
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];
  const router = useRouter();

  return (
    <div className="flex gap-1.5">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => router.push(`/reports/2316?year=${y}`)}
          className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-sm border transition-colors ${
            y === year
              ? "bg-[var(--brand)] text-white border-[var(--brand)]"
              : "border-[var(--border)] hover:bg-[var(--neutral-bg)] text-[var(--text-secondary)]"
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}
