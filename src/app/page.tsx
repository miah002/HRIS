import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users, Wallet, Clock, CalendarCheck, ShieldCheck, BarChart3,
  Check, ChevronDown, ArrowRight
} from "lucide-react";

function NavBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center border-b border-[var(--border)] bg-[var(--bg-overlay)] backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg-overlay)]">
      <div className="container flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <img src="/mmtsi-logo.png" alt="MMTSI" className="h-7 w-auto object-contain" />
          <span className="font-semibold text-sm tracking-tight text-[var(--text-primary)]">MMTSI <span className="text-[var(--text-tertiary)] font-normal">HRIS</span></span>
        </Link>
        <Link href="/login">
          <Button size="sm" className="gap-1">Sign in <ArrowRight className="h-3.5 w-3.5" /></Button>
        </Link>
      </div>
    </header>
  );
}

const FEATURES = [
  {
    icon: Users,
    title: "Digital 201 Files",
    desc: "TIN, SSS, PhilHealth, Pag-IBIG, contracts, and IDs in one place. Searchable, auditable, DICT-compliant.",
    bullets: ["Government ID tracking", "Employment history", "Document expiry alerts"],
  },
  {
    icon: Wallet,
    title: "PH-Accurate Payroll",
    desc: "Semi-monthly cutoffs (1–15, 16–end) with every statutory deduction computed to the centavo.",
    bullets: ["TRAIN Law withholding tax", "SSS / PhilHealth / Pag-IBIG tables", "13th month accrual tracker"],
  },
  {
    icon: Clock,
    title: "DTR & Overtime",
    desc: "Daily time records with overtime computed per Labor Code — no more manual rate lookups.",
    bullets: ["Regular OT at 125%", "Night differential +10%", "Rest day & holiday premiums"],
  },
  {
    icon: CalendarCheck,
    title: "Statutory Leaves",
    desc: "All PH-mandated leaves pre-configured. Approval workflows built in.",
    bullets: ["Maternity (RA 11210 — 105 days)", "Paternity (RA 8187 — 7 days)", "VL / SL company policy"],
  },
  {
    icon: ShieldCheck,
    title: "Compliance Calendar",
    desc: "Never miss an SSS, PhilHealth, Pag-IBIG, or BIR deadline. Alerts 7 days in advance.",
    bullets: ["BIR 1601-C monthly", "2316 by Jan 31", "DOLE reporting reminders"],
  },
  {
    icon: BarChart3,
    title: "Owner Analytics",
    desc: "Headcount, payroll cost, attrition, and overtime trends at a glance.",
    bullets: ["Payroll cost trend", "Tenure distribution", "Overtime cost heatmap"],
  },
];

const FAQ = [
  {
    q: "Is the payroll computation aligned with TRAIN Law?",
    a: "Yes. BIR withholding follows RR 11-2018 monthly tables. SSS, PhilHealth, and Pag-IBIG use the current contribution schedules.",
  },
  {
    q: "What statutory leaves are supported?",
    a: "Maternity (105 days, RA 11210), Paternity (7 days, RA 8187), plus VL and SL (15 days each) per company policy.",
  },
  {
    q: "How does overtime computation work?",
    a: "OT is logged per attendance record with a rate code (R_OT, RD, RH, SH, etc.). Pay is computed automatically using Labor Code multipliers.",
  },
  {
    q: "How does the compliance calendar work?",
    a: "It computes monthly remittance deadlines (BIR 1601-C, HDMF, PHIC, SSS) and queues January-specific deadlines (2316, 1604-C) every year.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <NavBar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-28">
        {/* Ambient depth — on-brand glow + soft grid, behind content */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[640px]
            bg-[radial-gradient(60%_55%_at_50%_-5%,color-mix(in_srgb,var(--brand)_22%,transparent)_0%,transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px
            bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--brand)_45%,transparent),transparent)]"
        />
        <div className="container max-w-3xl mx-auto text-center relative z-10">
          <Badge variant="brand" className="mb-5">Philippine HRIS Demo 🇵🇭</Badge>
          <h1 className="font-serif text-4xl md:text-5xl font-normal tracking-tight text-[var(--text-primary)] text-balance leading-[1.1]">
            HR software built for{" "}
            <em className="not-italic text-[var(--brand)]">MMTSI.</em>
          </h1>
          <p className="mt-5 text-base text-[var(--text-secondary)] max-w-xl mx-auto text-pretty leading-relaxed">
            Semi-monthly payroll, DOLE compliance, SSS/PhilHealth/Pag-IBIG remittances,
            and statutory leaves — in one mobile-ready app.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Sign in to demo <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            {["DOLE-compliant", "BIR TRAIN Law", "SSS/PHIC/HDMF", "RA 10173"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <Check className="h-3 w-3 text-[var(--success)]" />{t}
              </span>
            ))}
          </div>
          <div className="mt-6 text-xs text-[var(--text-tertiary)]">
            Demo credentials: <span className="font-mono text-[var(--text-secondary)]">owner@demo.ph</span> / <span className="font-mono text-[var(--text-secondary)]">demo1234</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-[var(--bg-subtle)]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-balance">
              Built around PH labor law,{" "}
              <span className="text-[var(--brand)]">not adapted from it.</span>
            </h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Every module references the specific regulation it implements.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} variant="flat" className="group hover:border-[var(--border-strong)] transition-colors">
                <CardContent className="pt-6">
                  <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--brand-subtle)] grid place-items-center mb-4 group-hover:bg-[var(--brand)] transition-colors">
                    <f.icon className="h-4 w-4 text-[var(--brand)] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
                  <ul className="mt-4 space-y-1.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                        <Check className="h-3 w-3 text-[var(--success)] mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="container max-w-2xl">
          <h2 className="font-serif text-3xl font-normal text-center mb-10">Frequently asked</h2>
          <div className="space-y-2">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-3 px-5 py-4 text-sm font-medium cursor-pointer list-none hover:bg-[var(--neutral-bg)] transition-colors">
                  {f.q}
                  <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)]">
                  <p className="pt-4">{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-6">
        <div className="container flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <span>MMTSI HRIS · Internal demo system</span>
          <Link href="/login" className="hover:text-[var(--text-primary)] transition-colors">Sign in →</Link>
        </div>
      </footer>
    </div>
  );
}
