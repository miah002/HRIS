"use client";

import React, { useEffect, useRef, useState } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/format";

// Count-up hook: animates a number from 0 → target in ~600ms.
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);
  return value;
}

// format is a string token (not a function) — functions can't cross the
// server→client component boundary.
type FormatKind = "number" | "currencyK" | "days";

interface KpiCardProps {
  label: string;
  sublabel?: string;
  value: number;
  format?: FormatKind;
  delta?: number;       // % change vs last period
  sparkData?: number[]; // 6–12 data points for sparkline
  className?: string;
  delay?: number;
}

function formatValue(n: number, kind: FormatKind) {
  switch (kind) {
    case "currencyK": return `₱${(n / 1000).toFixed(0)}k`;
    case "days":      return n === 0 ? "Today" : `${n}d`;
    default:          return n.toLocaleString("en-PH");
  }
}

export function KpiCard({
  label, sublabel, value, format = "number", delta, sparkData, className, delay = 0
}: KpiCardProps) {
  const animated = useCountUp(value);
  const trendColor =
    delta === undefined ? "var(--text-tertiary)" :
    delta > 0  ? "var(--success)" :
    delta < 0  ? "var(--error)" : "var(--text-tertiary)";
  const TrendIcon =
    delta === undefined ? Minus :
    delta > 0  ? TrendingUp :
    delta < 0  ? TrendingDown : Minus;

  const sparkPoints = sparkData?.map((v, i) => ({ v })) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay }}
      className={cn(
        "relative flex flex-col justify-between",
        "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)]",
        "p-5 overflow-hidden min-h-[120px]",
        className
      )}
    >
      {/* Label */}
      <div>
        <div className="text-xs font-medium text-[var(--text-tertiary)] tracking-wide">{label}</div>
        {sublabel && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sublabel}</div>}
      </div>

      {/* Value */}
      <div className="mt-3">
        <div className="text-2xl font-semibold text-[var(--text-primary)] tabular leading-none">
          {formatValue(animated, format)}
        </div>
        {delta !== undefined && (
          <div
            className="mt-1.5 flex items-center gap-1 text-xs font-medium"
            style={{ color: trendColor }}
          >
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(delta).toFixed(1)}% vs last month</span>
          </div>
        )}
      </div>

      {/* Sparkline — bottom-right, decorative */}
      {sparkPoints.length > 1 && (
        <div className="absolute bottom-0 right-0 h-12 w-24 pointer-events-none opacity-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkPoints} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="var(--brand)" strokeWidth={1.5} fill="url(#sg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
