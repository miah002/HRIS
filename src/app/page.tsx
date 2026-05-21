import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wallet, Clock, CalendarCheck, ShieldCheck, BarChart3, Check, Star } from "lucide-react";

const FEATURES = [
  { icon: Users, title: "Employee 201 Files", desc: "Digital 201 file with TIN, SSS, PhilHealth, Pag-IBIG and contract uploads." },
  { icon: Clock, title: "DTR & Attendance", desc: "Mobile clock-in, OT and night differential auto-computed per Labor Code." },
  { icon: Wallet, title: "Semi-monthly Payroll", desc: "1–15 and 16–end cutoffs with PH statutory deductions and BIR withholding." },
  { icon: CalendarCheck, title: "Statutory Leaves", desc: "SIL, Maternity (RA 11210), Paternity, Solo Parent, VAWC, Magna Carta." },
  { icon: ShieldCheck, title: "Compliance Calendar", desc: "Auto-reminders for SSS/PHIC/HDMF remittance and BIR 1601-C, 2316 deadlines." },
  { icon: BarChart3, title: "Owner Dashboard", desc: "Headcount, payroll cost, attrition and overtime cost — at a glance, on mobile." },
];

const TRUST = ["DOLE-compliant", "BIR-ready", "SSS / PhilHealth / Pag-IBIG", "Data Privacy Act (RA 10173)"];

const PRICING = [
  { name: "Free", price: "₱0", desc: "Up to 10 employees", features: ["Employee 201 files", "Manual DTR", "1 payroll cutoff/month"], cta: "Start free" },
  { name: "Starter", price: "₱999", desc: "Up to 25 employees", features: ["Everything in Free", "Semi-monthly payroll", "Leave workflow", "Email reminders"], cta: "Try Starter", featured: true },
  { name: "Growth", price: "₱2,499", desc: "Up to 100 employees", features: ["Everything in Starter", "Compliance dashboard", "BIR/SSS/PHIC export", "Multi-branch"], cta: "Try Growth" },
];

const FAQ = [
  { q: "Is the payroll computation aligned with TRAIN Law?", a: "Yes. Withholding tax follows BIR RR 11-2018 monthly tables. SSS, PhilHealth and Pag-IBIG use the current contribution schedules and are configurable so your finance team can update brackets when the agencies issue circulars." },
  { q: "Can my staff clock in from their phones?", a: "Yes — the app is a PWA, installable on any Android or iPhone. Geo-tagged clock-in is optional." },
  { q: "What about Maternity / Solo Parent leave?", a: "All statutory leaves are pre-configured: SIL (5d), Maternity 105d (RA 11210, +15 if solo parent), Paternity 7d (RA 8187), Solo Parent 7d (RA 11861), Magna Carta 60d (RA 9710), VAWC 10d (RA 9262)." },
  { q: "Is my employee data safe under the Data Privacy Act?", a: "We follow RA 10173. Data is stored in your tenant database, transmitted over TLS, and our privacy notice covers retention, access and breach response." },
  { q: "Can I import from my existing spreadsheet?", a: "Yes — bulk CSV import for employee 201s, with a downloadable template." },
];

export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary grid place-items-center text-primary-foreground font-bold">S</div>
            <span className="font-semibold">Sahod HR</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/register"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <Badge variant="muted" className="mb-4">Built for Philippine SMEs</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-navy-900">
            DOLE-compliant HR for your business — <span className="text-secondary">without the spreadsheet chaos.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Sahod HR is a mobile-first HRIS for restaurants, retail, BPO/VA agencies, and small manufacturing. Payroll, DTR, leaves, and BIR/SSS/PhilHealth/Pag-IBIG remittance — done.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register"><Button size="lg">Start free — up to 10 employees</Button></Link>
            <Link href="/login"><Button size="lg" variant="outline">Sign in to demo</Button></Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {TRUST.map((t) => (
              <Badge key={t} variant="outline" className="gap-1"><Check className="h-3 w-3" />{t}</Badge>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card shadow-lg p-6">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">This month</div>
          <div className="mt-1 text-3xl font-bold">₱687,420.50</div>
          <div className="text-sm text-muted-foreground">Total payroll · 24 employees</div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat label="SSS due" value="₱42,180" sub="Jan 31" />
            <Stat label="PHIC due" value="₱18,750" sub="Jan 11" />
            <Stat label="HDMF due" value="₱9,600" sub="Jan 10" />
            <Stat label="BIR 1601-C" value="₱28,440" sub="Jan 10" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/40 py-16">
        <div className="container">
          <h2 className="text-3xl font-bold text-center">Everything a PH business owner needs</h2>
          <p className="text-center text-muted-foreground mt-2">From 201 file to net pay — built around the Labor Code, BIR and SSS/PHIC/HDMF.</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardContent className="pt-6">
                  <f.icon className="h-6 w-6 text-secondary mb-3" />
                  <div className="font-semibold">{f.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16">
        <div className="container">
          <h2 className="text-3xl font-bold text-center">Simple Peso pricing</h2>
          <p className="text-center text-muted-foreground mt-2">All plans include statutory contributions, BIR withholding, and PWA mobile access.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {PRICING.map((p) => (
              <Card key={p.name} className={p.featured ? "border-secondary shadow-md" : ""}>
                <CardContent className="pt-6">
                  {p.featured && <Badge className="mb-3 bg-secondary text-secondary-foreground">Most popular</Badge>}
                  <div className="font-semibold">{p.name}</div>
                  <div className="mt-2 text-3xl font-bold">{p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                  <div className="text-sm text-muted-foreground">{p.desc}</div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary mt-0.5" />{feat}</li>
                    ))}
                  </ul>
                  <Link href="/register" className="block mt-6"><Button className="w-full" variant={p.featured ? "default" : "outline"}>{p.cta}</Button></Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">Placeholder pricing for portfolio demo. Final pricing TBD.</p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/40 py-16">
        <div className="container grid md:grid-cols-3 gap-4">
          {[
            { name: "Aling Nena's Carinderia", role: "Owner, Quezon City", quote: "Sahod HR replaced our notebook DTR. Sweldo computation is automatic — kasama na ang SSS at PhilHealth." },
            { name: "TaraVA Solutions", role: "BPO agency, Cebu", quote: "We onboarded 30 VAs in a week. The 201 file and contract uploads are simple, and the compliance calendar saved us from a late BIR filing." },
            { name: "Bicol Hardware Supply", role: "Retail, Legazpi City", quote: "Mobile clock-in for our branches plus payroll exports we just hand to our bookkeeper. Sulit." },
          ].map((t) => (
            <Card key={t.name}><CardContent className="pt-6">
              <div className="flex text-amber-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
              <p className="mt-3 text-sm">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4 text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.role}</div>
            </CardContent></Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16">
        <div className="container max-w-3xl">
          <h2 className="text-3xl font-bold text-center">Frequently asked</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-lg border bg-card p-4">
                <summary className="font-medium cursor-pointer">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Sahod HR. Portfolio demo.</div>
          <div className="flex gap-4">
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">Due {sub}</div>
    </div>
  );
}
