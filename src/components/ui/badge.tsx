import * as React from "react";
import { cn } from "@/lib/format";

type Variant = "default" | "brand" | "success" | "warning" | "error" | "neutral" | "outline";

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium leading-none tracking-wide whitespace-nowrap";

const variants: Record<Variant, string> = {
  default:  "bg-[var(--neutral-bg)] text-[var(--text-secondary)]",
  brand:    "bg-[var(--brand-subtle)] text-[var(--text-brand)]",
  success:  "bg-[var(--success-bg)] text-[var(--success)]",
  warning:  "bg-[var(--warning-bg)] text-[var(--warning)]",
  error:    "bg-[var(--error-bg)] text-[var(--error)]",
  neutral:  "bg-[var(--neutral-bg)] text-[var(--text-tertiary)]",
  outline:  "border border-[var(--border-strong)] text-[var(--text-secondary)] bg-transparent",
};

// Dot color per variant (matches the text/icon color of each variant)
const dotColor: Record<Variant, string> = {
  default: "var(--text-secondary)",
  brand:   "var(--text-brand)",
  success: "var(--success)",
  warning: "var(--warning)",
  error:   "var(--error)",
  neutral: "var(--text-tertiary)",
  outline: "var(--text-secondary)",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  dot?: boolean;
}

export function Badge({ className, variant = "default", dot = true, children, ...props }: BadgeProps) {
  return (
    <span className={cn(base, variants[variant], className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor[variant] }}
        />
      )}
      {children}
    </span>
  );
}

// Employment status → badge variant mapping (exported so pages can import it)
export const STATUS_BADGE: Record<string, BadgeProps["variant"]> = {
  REGULAR:      "success",
  PROBATIONARY: "warning",
  PROJECT:      "brand",
  CASUAL:       "neutral",
  CONTRACTUAL:  "neutral",
  RELEASED:     "brand",
  DRAFT:        "default",
  PENDING:      "warning",
  APPROVED:     "success",
  REJECTED:     "error",
};
