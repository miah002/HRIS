import * as React from "react";
import { cn } from "@/lib/format";

// Labels are always ABOVE inputs — one committed system.
// Focus ring: brand color ring with 2px offset + subtle glow.
// Currency input shows ₱ inline via a wrapper (see CurrencyInput below).

const inputBase =
  "flex w-full rounded-[var(--radius-sm)] border border-[var(--border)] " +
  "bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] " +
  "transition-colors duration-[100ms] " +
  "focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] focus:ring-offset-0 " +
  "disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-[var(--error)] aria-[invalid=true]:ring-[var(--error-border)] ";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={error ? true : ariaInvalid}
      className={cn("h-10 px-3 py-2", inputBase, className)}
      {...props}
    />
  )
);
Input.displayName = "Input";

// Textarea shares the same visual language
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("min-h-[80px] w-full px-3 py-2.5 resize-y", inputBase, className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// Currency prefix: ₱ always inline, never separated
export function CurrencyInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)] select-none">
        ₱
      </span>
      <Input className={cn("pl-7 tabular", className)} {...props} />
    </div>
  );
}

// Field: label + input + optional error helper — the standard composition
interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children?: React.ReactNode;
}
export function Field({ label, name, error, hint, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--error)]">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-[var(--error)] animate-slide-up" role="alert">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-[var(--text-tertiary)]">{hint}</p>
      )}
    </div>
  );
}
