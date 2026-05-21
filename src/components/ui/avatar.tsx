import * as React from "react";
import { cn } from "@/lib/format";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const sizes: Record<Size, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
  xl: "h-14 w-14 text-lg",
};

// Deterministic hue from a string — keeps avatars consistent across renders
function hueFromString(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  size?: Size;
}

export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
  const hue = hueFromString(name);

  return (
    <div
      aria-label={name}
      className={cn(
        "relative flex-shrink-0 overflow-hidden rounded-full",
        "flex items-center justify-center font-semibold tracking-tight",
        sizes[size],
        className
      )}
      style={
        src
          ? undefined
          : { backgroundColor: `hsl(${hue} 30% 80%)`, color: `hsl(${hue} 40% 25%)` }
      }
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

// Avatar group — overlapping, max 4 shown + overflow count
export function AvatarGroup({ names, max = 4 }: { names: string[]; max?: number }) {
  const visible = names.slice(0, max);
  const overflow = names.length - max;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((name) => (
        <Avatar key={name} name={name} size="sm" className="ring-2 ring-[var(--bg-elevated)]" />
      ))}
      {overflow > 0 && (
        <div className="h-7 w-7 rounded-full ring-2 ring-[var(--bg-elevated)] bg-[var(--bg-subtle)] flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)]">
          +{overflow}
        </div>
      )}
    </div>
  );
}
