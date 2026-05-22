"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Users, Clock, Wallet, CalendarCheck,
  ShieldCheck, BarChart3, LogOut, ChevronLeft, ChevronRight,
  Sun, Moon, Monitor, User, CreditCard
} from "lucide-react";
import { cn } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";

const OWNER_NAV = [
  { href: "/dashboard",  label: "Dashboard",  sub: "Overview",      icon: LayoutDashboard },
  { href: "/employees",  label: "Employees",  sub: "Mga Empleyado", icon: Users },
  { href: "/attendance", label: "Attendance", sub: "DTR",           icon: Clock },
  { href: "/payroll",    label: "Payroll",    sub: "Sahod",         icon: Wallet },
  { href: "/leave",      label: "Leave",      sub: "Bakasyon",      icon: CalendarCheck },
  { href: "/loans",      label: "Loans",      sub: "Salary loans",  icon: CreditCard },
  { href: "/compliance", label: "Compliance", sub: "DOLE/BIR",      icon: ShieldCheck },
  { href: "/reports",    label: "Reports",    sub: "Analytics",     icon: BarChart3 },
];

const EMPLOYEE_NAV = [
  { href: "/my", label: "My Portal", sub: "Self-service", icon: User },
];

function ThemeCycle() {
  const { theme, setTheme } = useTheme();
  const cycle = () => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <button
      onClick={cycle}
      title="Toggle theme"
      className="h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] transition-colors duration-fast"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function Sidebar({ userName = "Demo Owner", role = "OWNER" }: { userName?: string; role?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const NAV = role === "EMPLOYEE" ? EMPLOYEE_NAV : OWNER_NAV;
  const homeHref = role === "EMPLOYEE" ? "/my" : "/dashboard";

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: "spring", stiffness: 400, damping: 35, mass: 0.8 }}
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 z-30 overflow-hidden",
        "bg-[var(--bg-elevated)] border-r border-[var(--border)] flex-shrink-0"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4 gap-3 border-b border-[var(--border)] flex-shrink-0">
        <Link href={homeHref} className="flex items-center gap-3 flex-shrink-0">
          <div className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--brand)] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={false}
              animate={{ opacity: 1 }}
              className="font-semibold text-sm text-[var(--text-primary)] whitespace-nowrap"
            >
              Sahod HR
            </motion.span>
          )}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {!collapsed && <ThemeCycle />}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] transition-colors duration-fast"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ href, label, sub, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-sm)] px-2.5 h-9 transition-colors duration-fast",
                "text-sm group relative overflow-hidden",
                active
                  ? "bg-[var(--brand-subtle)] text-[var(--text-brand)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)]"
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--brand-subtle)]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn("h-4 w-4 flex-shrink-0 relative", active && "text-[var(--brand)]")} />
              {!collapsed && (
                <span className="relative flex flex-col min-w-0">
                  <span className="truncate leading-none">{label}</span>
                  {!active && (
                    <span className="text-[10px] text-[var(--text-tertiary)] leading-none mt-0.5">{sub}</span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={userName} size="sm" className="flex-shrink-0" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">{userName}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">{role === "EMPLOYEE" ? "Employee" : "Owner"}</div>
            </div>
          )}
          {!collapsed && (
            <Link
              href="/api/auth/signout"
              title="Sign out"
              className="h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] transition-colors duration-fast"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

export function BottomNav({ role = "OWNER" }: { role?: string }) {
  const pathname = usePathname();
  const NAV = role === "EMPLOYEE" ? EMPLOYEE_NAV : OWNER_NAV.slice(0, 5);
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-elevated)] border-t border-[var(--border)]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
    >
      <div className="flex justify-around pt-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-1.5 px-1 min-h-[44px] justify-center",
                "text-[10px] font-medium transition-colors duration-fast",
                active ? "text-[var(--brand)]" : "text-[var(--text-tertiary)]"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBarMobile({ title }: { title?: string }) {
  return (
    <div className="md:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-[var(--bg-overlay)] backdrop-blur-md border-b border-[var(--border)]">
      <div className="h-6 w-6 rounded-[4px] bg-[var(--brand)] flex items-center justify-center">
        <span className="text-white text-[10px] font-bold">S</span>
      </div>
      {title && <span className="font-semibold text-sm text-[var(--text-primary)]">{title}</span>}
      <div className="ml-auto"><ThemeCycle /></div>
    </div>
  );
}
