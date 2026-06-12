"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Users, Clock, Wallet, CalendarCheck,
  ShieldCheck, BarChart3, LogOut, ChevronLeft, ChevronRight,
  Sun, Moon, Monitor, User, CreditCard, ClipboardCheck, Settings,
  MoreHorizontal, X
} from "lucide-react";
import { cn } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";

const OWNER_NAV = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard, section: "Overview",   ownerOnly: false },
  { href: "/employees",   label: "Employees",   icon: Users,           section: "People",     ownerOnly: false },
  { href: "/attendance",  label: "Attendance",  icon: Clock,           section: "People",     ownerOnly: false },
  { href: "/payroll",     label: "Payroll",     icon: Wallet,          section: "Payroll",    ownerOnly: false },
  { href: "/ot-approval", label: "OT Approval", icon: ClipboardCheck,  section: "Payroll",    ownerOnly: false },
  { href: "/leave",       label: "Leave",       icon: CalendarCheck,   section: "People",     ownerOnly: false },
  { href: "/loans",       label: "Loans",       icon: CreditCard,      section: "Payroll",    ownerOnly: false },
  { href: "/compliance",  label: "Compliance",  icon: ShieldCheck,     section: "Governance", ownerOnly: false },
  { href: "/reports",     label: "Reports",     icon: BarChart3,       section: "Governance", ownerOnly: false },
  { href: "/settings",    label: "Settings",    icon: Settings,        section: "Governance", ownerOnly: true  },
];

// Desktop sidebar groups (decoupled from array order so mobile BottomNav slices stay sensible)
const SECTIONS = ["Overview", "People", "Payroll", "Governance"] as const;

const EMPLOYEE_NAV = [
  { href: "/my", label: "My Portal", icon: User, section: "Overview", ownerOnly: false },
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
  const NAV = role === "EMPLOYEE"
    ? EMPLOYEE_NAV
    : OWNER_NAV.filter((item) => !item.ownerOnly || role === "OWNER");
  const homeHref = role === "EMPLOYEE" ? "/my" : "/dashboard";

  const renderItem = (item: { href: string; label: string; icon: typeof Users }) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-[var(--radius)] h-9 transition-colors duration-fast text-sm",
          collapsed ? "justify-center px-0" : "px-2.5",
          active
            ? "text-[var(--text-primary)] font-medium"
            : "text-[var(--text-secondary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)]"
        )}
      >
        {active && (
          <motion.div
            layoutId="nav-pill"
            className="absolute inset-0 rounded-[var(--radius)] bg-[var(--brand-subtle)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--brand)_20%,transparent)]"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        )}
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--brand)]" />
        )}
        <Icon className={cn("relative h-[18px] w-[18px] flex-shrink-0", active && "text-[var(--brand)]")} />
        {!collapsed && <span className="relative truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 248 }}
      transition={{ type: "spring", stiffness: 400, damping: 35, mass: 0.8 }}
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 z-30 overflow-hidden",
        "surface-chrome border-r border-[var(--border)] flex-shrink-0"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-16 items-center gap-2.5 flex-shrink-0", collapsed ? "px-0 justify-center" : "px-4")}>
        <Link href={homeHref} className="flex items-center gap-2.5 min-w-0">
          <img src="/mmtsi-logo.png" alt="MMTSI" className="h-7 w-auto object-contain flex-shrink-0" />
          {!collapsed && (
            <span className="flex flex-col leading-none min-w-0">
              <span className="font-semibold text-sm tracking-tight text-[var(--text-primary)] truncate">MMTSI</span>
              <span className="text-[10px] tracking-[0.12em] text-[var(--text-tertiary)] uppercase mt-0.5">HRIS</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <div className="ml-auto flex items-center gap-1">
            <ThemeCycle />
            <button
              onClick={() => setCollapsed(true)}
              className="h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] transition-colors duration-fast"
              title="Collapse"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mb-1 h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] transition-colors duration-fast"
          title="Expand"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Nav — grouped into sections when expanded, flat when collapsed */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-4">
        {collapsed
          ? <div className="space-y-1">{NAV.map(renderItem)}</div>
          : SECTIONS.map((sec) => {
              const items = NAV.filter((i) => i.section === sec);
              if (items.length === 0) return null;
              return (
                <div key={sec} className="space-y-0.5">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    {sec}
                  </div>
                  {items.map(renderItem)}
                </div>
              );
            })}
      </nav>

      {/* Footer — user card */}
      <div className="flex-shrink-0 p-3">
        <div className={cn("flex items-center gap-2.5", !collapsed && "rounded-[var(--radius)] bg-[var(--bg-subtle)] ring-1 ring-inset ring-[var(--border)] p-2")}>
          <Avatar name={userName} size="sm" className="flex-shrink-0" />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)] truncate">{userName}</div>
                <div className="text-[10px] text-[var(--text-tertiary)] capitalize">{role.charAt(0) + role.slice(1).toLowerCase()}</div>
              </div>
              <Link
                href="/api/auth/signout"
                title="Sign out"
                className="h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] transition-colors duration-fast"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

export function BottomNav({ role = "OWNER" }: { role?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const allNav = role === "EMPLOYEE"
    ? EMPLOYEE_NAV
    : OWNER_NAV.filter((item) => !item.ownerOnly || role === "OWNER");

  const primary = allNav.slice(0, 4);
  const secondary = allNav.slice(4);
  const moreActive = secondary.some(({ href }) => pathname === href || pathname.startsWith(href + "/"));

  // Close "More" drawer on navigation
  React.useEffect(() => { setMoreOpen(false); }, [pathname]);

  return (
    <>
      {/* More drawer overlay */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 bg-[var(--bg-elevated)] rounded-t-2xl border-t border-[var(--border)] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[var(--text-primary)]">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-[var(--neutral-bg)] text-[var(--text-tertiary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondary.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-2 py-3 px-2 rounded-[var(--radius-md)] transition-colors",
                      active
                        ? "bg-[var(--brand-subtle)] text-[var(--brand)]"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--neutral-bg)]"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium text-center leading-tight">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-elevated)] border-t border-[var(--border)]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
      >
        <div className="flex justify-around pt-1">
          {primary.map(({ href, label, icon: Icon }) => {
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
          {/* More button */}
          {secondary.length > 0 && (
            <button
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-1.5 px-1 min-h-[44px] justify-center",
                "text-[10px] font-medium transition-colors duration-fast",
                (moreOpen || moreActive) ? "text-[var(--brand)]" : "text-[var(--text-tertiary)]"
              )}
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

export function TopBarMobile({ title }: { title?: string }) {
  return (
    <div className="md:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-[var(--bg-overlay)] backdrop-blur-md border-b border-[var(--border)]">
      <img src="/mmtsi-logo.png" alt="MMTSI" className="h-6 w-auto object-contain" />
      {title && <span className="font-semibold text-sm text-[var(--text-primary)]">{title}</span>}
      <div className="ml-auto"><ThemeCycle /></div>
    </div>
  );
}
