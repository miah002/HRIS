"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const REPORTS = [
  { label: "SSS R-3",       href: (m: string) => `/api/reports/sss-r3?month=${m}` },
  { label: "PhilHealth RF-1", href: (m: string) => `/api/reports/phic-rf1?month=${m}` },
  { label: "Pag-IBIG MCRF", href: (m: string) => `/api/reports/hdmf-mcrf?month=${m}` },
  { label: "BIR 1601-C",    href: (m: string) => `/api/reports/bir-1601c?month=${m}` },
];

export function ComplianceDownloads() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const years = [now.getFullYear() - 1, now.getFullYear()];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        >
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <a key={r.label} href={r.href(monthStr)} download>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {r.label}
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}
