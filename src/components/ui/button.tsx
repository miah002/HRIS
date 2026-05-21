import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/format";

// Three sizes only: sm (32px), md (40px), lg (48px). No others.
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon-sm" | "icon-md";

const base =
  "relative inline-flex items-center justify-center gap-2 font-medium leading-none select-none " +
  "transition-all duration-fast ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-ring)] " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "active:scale-[0.97] ";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-xs " +
    "hover:bg-[var(--brand-dim)] hover:shadow-sm " +
    "[background-image:linear-gradient(rgba(255,255,255,0.04)_0%,rgba(0,0,0,0.04)_100%)] ",
  secondary:
    "bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] " +
    "hover:bg-[var(--bg)] hover:border-[var(--border-strong)] ",
  ghost:
    "text-[var(--text-secondary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] ",
  danger:
    "bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error-border)] " +
    "hover:bg-[var(--error)] hover:text-white ",
  outline:
    "border border-[var(--border)] text-[var(--text-primary)] bg-transparent " +
    "hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] ",
};

const sizes: Record<Size, string> = {
  sm:      "h-8  px-3   text-xs  rounded-[var(--radius-sm)]",
  md:      "h-10 px-4   text-sm  rounded-[var(--radius)]",
  lg:      "h-12 px-6   text-sm  rounded-[var(--radius-md)]",
  "icon-sm": "h-8  w-8  text-sm  rounded-[var(--radius-sm)]",
  "icon-md": "h-10 w-10 text-sm  rounded-[var(--radius)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </>
        ) : children}
      </Comp>
    );
  }
);
Button.displayName = "Button";
