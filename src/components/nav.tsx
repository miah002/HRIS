"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { LayoutDashboard, Users, Clock, Wallet, CalendarCheck, ShieldCheck, BarChart3, LogOut } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", labelTl: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", labelTl: "Empleyado", icon: Users },
  { href: "/attendance", label: "Attendance", labelTl: "Pasok", icon: Clock },
  { href: "/payroll", label: "Payroll", labelTl: "Sahod", icon: Wallet },
  { href: "/leave", label: "Leave", labelTl: "Bakasyon", icon: CalendarCheck },
  { href: "/compliance", label: "Compliance", labelTl: "Pagsunod", icon: ShieldCheck },
  { href: "/reports", label: "Reports", labelTl: "Ulat", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:border-r md:bg-card md:h-screen md:sticky md:top-0">
      <div className="px-6 py-5 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary grid place-items-center text-primary-foreground font-bold">S</div>
          <div>
            <div className="font-semibold">Sahod HR</div>
            <div className="text-xs text-muted-foreground">DOLE-compliant HR</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t">
        <Link href="/api/auth/signout" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted">
          <LogOut className="h-4 w-4" /> Sign out
        </Link>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV.slice(0, 5);
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex justify-around pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 flex-1 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
