export function php(n: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(n);
}

export function phDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric", month: "short", day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
}

/** Returns a Date whose .getDate()/.getMonth()/.getFullYear()/.getHours() reflect Philippine time. */
export function nowPH(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}

/** Converts any UTC Date to a Date whose local methods (.getHours etc.) return Philippine time values. */
export function toPhDate(d: Date): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}

// Lightweight cn — for a real project, swap with clsx + tailwind-merge
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}
