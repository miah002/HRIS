# Sahod HR — DOLE-compliant HRIS for Philippine SMEs

A portfolio-grade HR & payroll web app targeting Philippine small businesses (10–100 employees) who currently run HR on spreadsheets. Mobile-first PWA. Built around real Philippine compliance requirements (Labor Code, BIR TRAIN, SSS/PhilHealth/Pag-IBIG).

> Demo login: **`owner@demo.ph` / `demo1234`**

---

## Stack

- **Next.js 15** (App Router, Server Actions, React 19)
- **TypeScript**, **Tailwind CSS** (shadcn-style primitives, hand-rolled to stay dependency-light)
- **Prisma** + **SQLite** (swap `provider = "postgresql"` in `prisma/schema.prisma` for prod)
- **NextAuth v5** (credentials + optional Google OAuth)
- **Recharts** for analytics
- **PWA** via `public/manifest.json` + `public/sw.js` (installable on mobile)

## Getting started

```bash
npm install
cp .env.example .env            # creates SQLite db at prisma/dev.db
npx prisma db push              # apply schema
npm run db:seed                 # 15 PH employees + demo owner
npm run dev
```

Open <http://localhost:3000>. Click **Sign in** and use the demo credentials.

## Project structure

```
src/
  app/
    page.tsx                 # marketing landing page
    login/, register/        # auth (NextAuth credentials)
    api/auth/[...nextauth]/  # NextAuth route handler
    (app)/                   # protected routes (sidebar + bottom nav)
      dashboard/             # owner KPI dashboard
      employees/             # 201 file CRUD (fully implemented)
      payroll/               # semi-monthly payroll runner (fully implemented)
      attendance/            # DTR view (read-only demo, schema ready)
      leave/                 # statutory leave (workflow demo, schema ready)
      compliance/            # statutory deadline tracker (computed)
      reports/               # Recharts: headcount, tenure, payroll trend
  lib/
    ph-payroll.ts            # SSS / PhilHealth / Pag-IBIG / BIR WHT engine
    auth.ts                  # NextAuth v5 config
    prisma.ts, format.ts
  components/ui/             # Button, Card, Input, Label, Badge
  components/nav.tsx         # Sidebar (desktop) + bottom nav (mobile)
prisma/
  schema.prisma              # Company, Employee, Attendance, Payroll, LeaveRequest, Document
  seed.ts                    # demo data
public/
  manifest.json, sw.js, icon-{192,512}.svg
```

## What's live vs. mocked (for portfolio reviewers)

| Area | Status |
|---|---|
| Authentication (credentials, JWT sessions) | **Live** — bcrypt-hashed, Prisma adapter |
| Employee 201 file CRUD | **Live** — list, create, detail, archive |
| Payroll engine (SSS, PHIC, HDMF, TRAIN WHT) | **Live** — `src/lib/ph-payroll.ts`, persisted per cutoff |
| Payroll run UI (semi-monthly cutoffs) | **Live** — totals, EE/ER split, per-employee table |
| Owner dashboard KPIs | **Live** — derived from DB + payroll engine |
| Reports (headcount, tenure, payroll trend) | **Live** — Recharts on real seed data |
| Statutory deadline calendar | **Live** — computed, ref-tagged to regulations |
| PWA install + service worker | **Live** — `manifest.json`, `sw.js` registered in `layout.tsx` |
| Statutory leave entitlement reference | **Live** — `STATUTORY_LEAVE` constant w/ RA references |
| Leave request → approve workflow UI | **Mocked** — schema is live, UI uses sample data |
| Attendance clock-in / DTR | **Mocked** — schema is live (`Attendance` model w/ OT/ND), UI is read-only |
| CSV bulk import | **Stubbed** (button disabled) |
| Payslip / DTR PDF export | **Stubbed** |
| Google OAuth | **Optional** — set `GOOGLE_CLIENT_ID` / `_SECRET` in `.env` |

## Philippine compliance — implemented in code

Every numeric source in `src/lib/ph-payroll.ts` is tagged with the regulation that governs it:

- **Labor Code Art. 86–87** — OT (125% regular, 130% rest day), night differential (+10%)
- **RA 11199 / SSS Circular 2023-006** — SSS contribution schedule, MSC ₱5,000–₱35,000, 4.5% EE / 10% ER
- **RA 11223 (UHC Act)** — PhilHealth 5% premium, floor ₱10,000, ceiling ₱100,000, 50/50 split
- **HDMF Circular 460** — Pag-IBIG 2% EE / 2% ER, ₱10,000 MSC cap
- **RA 10963 (TRAIN Law) / BIR RR 11-2018** — monthly withholding tax brackets
- **PD 851** — 13th month pay accrual
- **RA 11210** — Expanded Maternity Leave (105 days, +15 for solo parent)
- **RA 8187** — Paternity Leave (7 days)
- **RA 11861** — Expanded Solo Parents Welfare (7 days)
- **RA 9710** — Magna Carta of Women (60-day special leave)
- **RA 9262** — VAWC leave (10 days)
- **DO 174** — surfaced in employment-status options for contracting/subcontracting
- **RA 10173 (Data Privacy Act)** — referenced in landing + compliance pages
- **BIR RR 2-98 §2.83.1** — 2316 distribution by Jan 31

Contribution tables drift annually. The constants in `ph-payroll.ts` are isolated for easy promotion to a `ContributionSchedule` DB table in production.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import into Vercel. Set env vars: `DATABASE_URL` (Postgres recommended, e.g. Neon/Supabase), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
3. Switch `provider` in `prisma/schema.prisma` to `"postgresql"`.
4. After first deploy, run `npx prisma db push` then `npm run db:seed` against the prod DB.

## Design decisions

- **Server Actions over /api routes** for mutations — fewer round-trips, type-safe, fewer files.
- **Hand-rolled shadcn-style primitives** instead of `npx shadcn add` to keep the dep graph small and the diff readable for reviewers.
- **SQLite default** so a reviewer can `npm i && db:push && db:seed && dev` in 60 seconds without provisioning anything.
- **PH compliance logic isolated** in `src/lib/ph-payroll.ts` — pure functions, no DB calls, trivially unit-testable.
- **Mobile-first**: bottom nav under `md`, sidebar from `md+`. Tables collapse to cards on mobile.

## License

Portfolio demo. Not licensed for production use without review of contribution tables against current SSS/PHIC/HDMF/BIR circulars.
