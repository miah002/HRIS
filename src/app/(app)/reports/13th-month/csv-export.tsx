"use client";

import { Download } from "lucide-react";

interface Props {
  filename: string;
  headers: string[];
  rows: string[][];
}

export function CsvExport({ filename, headers, rows }: Props) {
  function download() {
    const all = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([all], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] hover:bg-[var(--neutral-bg)] transition-colors"
    >
      <Download className="h-3.5 w-3.5" /> Export CSV
    </button>
  );
}
