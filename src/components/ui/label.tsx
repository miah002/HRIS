import * as React from "react";
import { cn } from "@/lib/format";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-xs font-medium text-[var(--text-secondary)] leading-none", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";
