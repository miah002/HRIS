import { cn } from "@/lib/format";

// Skeletons exactly mirror the loaded layout — no spinners on page-level loads.
// Use the shimmer utility from globals.css for the animation.

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  inline?: boolean;
}

export function Skeleton({ className, inline, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading…"
      className={cn(
        "animate-shimmer rounded-[var(--radius-sm)]",
        "[background:linear-gradient(90deg,var(--bg-subtle)_0%,var(--bg-elevated)_50%,var(--bg-subtle)_100%)]",
        "[background-size:200%_100%]",
        inline ? "inline-block" : "block",
        className
      )}
      {...props}
    />
  );
}

// Pre-composed skeleton layouts for the most common views
export function SkeletonKpiCard() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr>
      {[48, 32, 24, 20, 24].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3.5" style={{ width: `${w * 3}px`, maxWidth: "100%" }} />
        </td>
      ))}
    </tr>
  );
}
