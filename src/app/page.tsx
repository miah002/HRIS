import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users, Wallet, Clock, CalendarCheck, ShieldCheck, BarChart3,
  Check, Star, ArrowRight, ChevronDown
} from "lucide-react";

/* ── Landing-page-only components ──────────────────────────────────── */

function NavBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center border-b border-[rgba(0,0,0,0.06)] bg-[rgba(250,250,249,0.85)] backdrop-blur-md">
      <div className="container flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-[6px] bg-[var(--brand)] flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="font-semibold text-sm text-[var(--text-primary)]">Sahod HR</span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm">
          {["#features", "#pricing", "#faq"].map((href) => (
            <a key={href} href={href}
               className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors capitalize">
              {href.slice(1)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="hidden md:inline-flex">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get started →</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

// Browser chrome mockup wrapping a dashboard preview
function BrowserMockup() {
  return (
    <div className="rounded-[var(--radius-lg)] overflow-hidden border border-[rgba(0,0,0,0.1)] shadow-xl">
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#F0EDE8] border-b border-[rgba(0,0,0,0.08)]">
        <div className="flex gap-1.5">
          {["#FF5F57","#FEBC2E","#28C840"].map((c) => (
            <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="flex-1 mx-4 bg-white/70 rounded-[4px] px-3 py-1 text-[10px] text-[#8A8A8A]">
          app.sahodhr.ph/dashboard
        </div>
      </div>

      {/* Mini dashboard */}
      <div className="bg-[#FAFAF9] p-4 space-y-3">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#6B6B6B]">Magandang umaga, Maria</div>
            <div className="text-[10px] text-[#A3A3A3]">May 1–15, 2026</div>
          </div>
          <div className="h-6 w-6 rounded-full bg-[#0FA896] text-white text-[9px] font-bold grid place-items-center">M</div>
        </div>
        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Employees", value: "24" },
            { label: "Payroll", value: "₱687k" },
            { label: "Leaves", value: "3" },
            { label: "Deadline", value: "4d" },
          ].map((k) => (
            <div key={k.label} className="rounded-[6px] border border-[rgba(0,0,0,0.07)] bg-white p-2">
              <div className="text-[9px] text-[#A3A3A3]">{k.label}</div>
              <div className="text-sm font-semibold text-[#0F0F0F] tabular">{k.value}</div>
            </div>
          ))}
        </div>
        {/* Chart placeholder */}
        <div className="rounded-[6px] border border-[rgba(0,0,0,0.07)] bg-white p-3">
          <div className="text-[9px] text-[#A3A3A3] mb-2">Payroll cost trend</div>
          <svg viewBox="0 0 200 40" className="w-full">
            <polyline
              points="0,38 33,35 67,32 100,28 133,24 167,20 200,16"
              fill="none" stroke="#0FA896" strokeWidth="1.5" strokeLinecap="round"
            />
            <path
              d="M0,38 33,35 67,32 100,28 133,24 167,20 200,16 V40 H0Z"
              fill="url(#grad)" opacity="0.2"
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0FA896" />
                <stop offset="100%" stopColor="#0FA896" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Page sections ─────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Users,
    title: "Digital 201 Files",
    desc: "TIN, SSS, PhilHealth, Pag-IBIG, contracts, and IDs in one place. Searchable, auditable, DICT-compliant.",
    bullets: ["Bulk CSV import", "Government ID tracking", "Document expiry alerts"],
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
    desc: "All PH-mandated leaves pre-configured. Approval workflows with email notifications.",
    bullets: ["SIL, Maternity (RA 11210)", "Solo Parent (RA 11861)", "VAWC & Magna Carta"],
  },
  {
    icon: ShieldCheck,
    title: "Compliance Calendar",
    desc: "Never miss an SSS, PhilHealth, Pag-IBIG, or BIR deadline again. Alerts 7 days in advance.",
    bullets: ["BIR 1601-C monthly", "2316 by Jan 31", "DOLE reporting reminders"],
  },
  {
    icon: BarChart3,
    title: "Owner Analytics",
    desc: "Headcount, payroll cost, attrition, and overtime trends. Designed for the owner checking in from a phone.",
    bullets: ["Payroll cost trend", "Tenure distribution", "Overtime cost heatmap"],
  },
];

const PRICING = [
  {
    name: "Free",
    price: 0,
    desc: "Up to 10 employees",
    features: ["Employee 201 files", "Manual DTR", "1 payroll cutoff/month", "Community support"],
  },
  {
    name: "Starter",
    price: 999,
    desc: "Up to 25 employees",
    popular: true,
    features: ["Everything in Free", "Semi-monthly payroll", "Statutory leave workflow", "Email deadline alerts", "CSV payroll export"],
  },
  {
    name: "Growth",
    price: 2499,
    desc: "Up to 100 employees",
    features: ["Everything in Starter", "Full compliance dashboard", "BIR/SSS/PHIC export", "Multi-branch support", "Priority support"],
  },
];

const TESTIMONIALS = [
  {
    name: "Aling Nena's Carinderia",
    role: "Owner · Quezon City",
    quote: "Sahod HR replaced our notebook DTR. Sweldo computation is automatic — kasama na ang SSS at PhilHealth. Grabe ang sarap.",
  },
  {
    name: "TaraVA Solutions",
    role: "BPO Agency · Cebu City",
    quote: "We onboarded 30 VAs in a week. 201 files, contract uploads, compliance calendar — this saved us from a late BIR filing.",
  },
  {
    name: "Bicol Hardware Supply",
    role: "Retail · Legazpi City",
    quote: "Mobile clock-in works at all three branches. The payroll export we hand to our bookkeeper every cutoff. Sobrang sulit.",
  },
];

const FAQ = [
  {
    q: "Is the payroll computation aligned with TRAIN Law?",
    a: "Yes. BIR withholding follows RR 11-2018 monthly tables. SSS, PhilHealth, and Pag-IBIG use the current contribution schedules — each table is tagged to the specific regulation and can be updated by your finance team without a code change.",
  },
  {
    q: "What statutory leaves are supported?",
    a: "All PH-mandated types: SIL (5 days, Art. 95), Maternity (105 days, RA 11210 — +15 for solo parents), Paternity (7 days, RA 8187), Solo Parent (7 days, RA 11861), Magna Carta (60 days, RA 9710), VAWC (10 days, RA 9262), and configurable Bereavement.",
  },
  {
    q: "Can my team clock in from their phones?",
    a: "Yes — Sahod HR is a PWA (Progressive Web App), installable on Android or iPhone from your browser. Optional geo-tagged clock-in validates location without requiring a separate native app.",
  },
  {
    q: "How does the compliance calendar work?",
    a: "It computes your monthly remittance deadlines (BIR 1601-C on the 10th, HDMF on the 10th, PHIC on the 11th, SSS on the 31st) and sends email alerts 7 days and 1 day before each. January-specific deadlines (2316, 1604-C) are auto-queued every year.",
  },
  {
    q: "What about the Data Privacy Act?",
    a: "We comply with RA 10173. Employee data is isolated per tenant, transmitted over TLS, and our privacy notice covers retention periods, access controls, and breach response procedures.",
  },
];

const PH_LOGOS = [
  "Juan's Kainan", "TaraVA Solutions", "BatiBot Creatives",
  "Kuya Mark's Supplies", "Nena's Carinderia", "Pinoy Builder Co.",
];

/* ── Default export ──────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <NavBar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="gradient-mesh pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="container grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="brand" className="mb-5">Built for Philippine SMEs 🇵🇭</Badge>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-[var(--text-primary)] text-balance leading-[1.1]">
              HR software built for the{" "}
              <em className="not-italic text-[var(--brand)]">Pinoy SME hustle.</em>
            </h1>
            <p className="mt-5 text-base text-[var(--text-secondary)] max-w-md text-pretty leading-relaxed">
              Semi-monthly payroll, DOLE compliance, SSS/PhilHealth/Pag-IBIG remittances,
              and statutory leaves — in one mobile-ready app. No spreadsheets. No chaos.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary">Sign in to demo</Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {["DOLE-compliant", "BIR TRAIN", "SSS/PHIC/HDMF", "RA 10173"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Check className="h-3 w-3 text-[var(--success)]" />{t}
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <BrowserMockup />
            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] px-4 py-3 shadow-md">
              <div className="text-2xs text-[var(--text-tertiary)]">Next deadline</div>
              <div className="text-sm font-semibold">BIR 1601-C · Jun 10</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logo cloud ───────────────────────────────────────────── */}
      <section className="border-y border-[var(--border)] py-6">
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-8">
            <span className="text-xs text-[var(--text-tertiary)] mr-2 whitespace-nowrap">Trusted by PH businesses:</span>
            {PH_LOGOS.map((name) => (
              <span key={name} className="text-sm font-medium text-[var(--text-tertiary)]">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-20">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <Badge variant="neutral" className="mb-4">Everything in one place</Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-balance">
              Built around PH labor law,{" "}
              <span className="text-[var(--brand)]">not adapted from it.</span>
            </h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Every module references the specific regulation it implements. No guessing if it&rsquo;s correct.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
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

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 bg-[var(--bg-subtle)]">
        <div className="container">
          <div className="max-w-xl mx-auto text-center mb-12">
            <Badge variant="neutral" className="mb-4">Simple Peso pricing</Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight">
              Start free, scale as you grow.
            </h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">All plans include statutory computations, BIR withholding, and PWA mobile access.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {PRICING.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] p-6 ${
                  p.popular
                    ? "ring-2 ring-[var(--brand)] shadow-md"
                    : "border border-[var(--border)]"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="brand" className="shadow-sm">Most popular</Badge>
                  </div>
                )}
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-semibold tabular">
                    {p.price === 0 ? "Free" : `₱${p.price.toLocaleString("en-PH")}`}
                  </span>
                  {p.price > 0 && <span className="text-xs text-[var(--text-tertiary)] mb-1">/mo</span>}
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{p.desc}</div>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-xs">
                      <Check className="h-3 w-3 text-[var(--success)] mt-0.5 flex-shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block mt-6">
                  <Button
                    variant={p.popular ? "primary" : "secondary"}
                    className="w-full"
                  >
                    {p.price === 0 ? "Start for free" : `Try ${p.name}`}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-2xs text-[var(--text-tertiary)] mt-6">
            Placeholder pricing for portfolio demo. Final pricing TBD.
          </p>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container">
          <h2 className="font-serif text-3xl text-center mb-10 font-normal">
            PH business owners, in their own words.
          </h2>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} variant="raised">
                <CardContent className="pt-5">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-[var(--warning)] text-[var(--warning)]" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-[var(--bg-subtle)]">
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

      {/* ── CTA Banner ───────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] px-8 py-12 shadow-sm">
            <h2 className="font-serif text-3xl font-normal tracking-tight">
              Ready to ditch the spreadsheets?
            </h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Free for up to 10 employees. No credit card. Setup in under 5 minutes.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/register"><Button size="lg">Start for free</Button></Link>
              <Link href="/login"><Button size="lg" variant="secondary">Try the demo</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-[var(--bg-inverted)] text-[var(--bg-subtle)]">
        <div className="container py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-[4px] bg-[var(--brand)] grid place-items-center">
                  <span className="text-white text-[9px] font-bold">S</span>
                </div>
                <span className="font-semibold text-sm text-white">Sahod HR</span>
              </div>
              <p className="text-xs text-[#666] leading-relaxed">
                DOLE-compliant HR for Philippine SMEs. Built with care in the Philippines. 🇵🇭
              </p>
            </div>
            <div>
              <div className="text-xs font-medium text-white mb-3 uppercase tracking-wide">Product</div>
              <ul className="space-y-2 text-xs text-[#666]">
                {["Features", "Pricing", "Changelog"].map((l) => (
                  <li key={l}><a href="#" className="hover:text-[#A3A3A3] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium text-white mb-3 uppercase tracking-wide">Legal</div>
              <ul className="space-y-2 text-xs text-[#666]">
                {["Privacy Policy", "Terms of Use", "DPA Notice (RA 10173)"].map((l) => (
                  <li key={l}><a href="#" className="hover:text-[#A3A3A3] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium text-white mb-3 uppercase tracking-wide">Support</div>
              <ul className="space-y-2 text-xs text-[#666]">
                {["Documentation", "Contact", "GitHub"].map((l) => (
                  <li key={l}><a href="#" className="hover:text-[#A3A3A3] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-[rgba(255,255,255,0.07)] pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#555]">
            <span>© {new Date().getFullYear()} Sahod HR. Portfolio demo — not for production use.</span>
            <Link href="/login" className="hover:text-[#A3A3A3] transition-colors">Sign in →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
