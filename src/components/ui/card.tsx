import * as React from "react";
import { cn } from "@/lib/format";

// Elevation system: flat (border only), raised (shadow-xs), elevated (shadow-sm)
type CardVariant = "flat" | "raised" | "elevated";

const cardBase = "rounded-[var(--radius-md)] bg-[var(--bg-elevated)] transition-shadow duration-base";
const cardVariants: Record<CardVariant, string> = {
  flat:     "border border-[var(--border)]",
  raised:   "shadow-xs",
  elevated: "shadow-sm",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
}

export function Card({ className, variant = "flat", interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        cardBase,
        cardVariants[variant],
        interactive && "cursor-pointer hover:shadow-sm hover:border-[var(--border-strong)] active:scale-[0.995]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-[var(--text-primary)] leading-snug", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-[var(--text-tertiary)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 px-5 pb-5 pt-0", className)} {...props} />;
}
