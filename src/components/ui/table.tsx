import * as React from "react";
import { cn } from "@/lib/format";

// HR software is 60% tables. These need to be exceptional.
// Sticky headers, generous cell padding, hairline borders, subtle hover.

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-[var(--bg-subtle)]",
        "[&>tr]:border-b [&>tr]:border-[var(--border)]",
        className
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("[&>tr]:border-b [&>tr]:border-[var(--border)] [&>tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn("border-t border-[var(--border)] bg-[var(--bg-subtle)] font-medium", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "group transition-colors duration-[100ms]",
        "hover:bg-[var(--bg-subtle)]",
        className
      )}
      {...props}
    />
  );
}

// Column header — optional sort indicator
interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sorted?: "asc" | "desc" | null;
}

export function Th({ className, sortable, sorted, children, ...props }: ThProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] tracking-wide uppercase",
        sortable && "cursor-pointer select-none hover:text-[var(--text-secondary)]",
        className
      )}
      {...props}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortable && (
          <span className={cn("opacity-40 transition-opacity", sorted && "opacity-100")}>
            {sorted === "desc" ? "↓" : "↑"}
          </span>
        )}
      </span>
    </th>
  );
}

export function Td({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-[var(--text-primary)] align-middle",
        numeric && "text-right tabular",
        className
      )}
      {...props}
    />
  );
}
