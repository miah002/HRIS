import { prisma } from "@/lib/prisma";
import { nowPH } from "@/lib/format";
import { cutoffForDate, nextCutoff, type Cutoff } from "@/lib/cutoff";

/**
 * The active cutoff for a company = the oldest OPEN PayrollPeriod.
 * Falls back to the date-derived cutoff when no OPEN period exists yet
 * (fresh company / before any payroll run). Read-only: OPEN rows are created
 * on write paths (ensureOpenPeriod / closeCutoff) and by the prod backfill.
 */
export async function activeCutoff(companyId: string): Promise<Cutoff> {
  const open = await prisma.payrollPeriod.findFirst({
    where: { companyId, status: "OPEN" },
    orderBy: { periodStart: "asc" },
  });
  if (open) {
    return { start: open.periodStart, end: open.periodEnd, label: open.label };
  }
  return cutoffForDate(nowPH());
}

/** Idempotently ensure an OPEN PayrollPeriod row exists for the given cutoff. */
export async function ensureOpenPeriod(companyId: string, c: Cutoff): Promise<void> {
  await prisma.payrollPeriod.upsert({
    where: { companyId_periodStart_periodEnd: { companyId, periodStart: c.start, periodEnd: c.end } },
    update: {},
    create: { companyId, periodStart: c.start, periodEnd: c.end, label: c.label, status: "OPEN" },
  });
}

/**
 * Close `period` and open the next cutoff so work advances exactly one period.
 * Guard: refuses while any DRAFT payroll row exists for the period. Returns
 * { ok: false, reason: "DRAFTS_EXIST" } when blocked.
 */
export async function closeCutoff(
  companyId: string,
  period: Cutoff,
  userId: string | undefined,
): Promise<{ ok: boolean; reason?: string }> {
  const drafts = await prisma.payroll.count({
    where: { periodStart: period.start, periodEnd: period.end, status: "DRAFT" },
  });
  if (drafts > 0) return { ok: false, reason: "DRAFTS_EXIST" };

  await prisma.payrollPeriod.upsert({
    where: { companyId_periodStart_periodEnd: { companyId, periodStart: period.start, periodEnd: period.end } },
    update: { status: "CLOSED", closedBy: userId ?? null, closedAt: new Date() },
    create: {
      companyId, periodStart: period.start, periodEnd: period.end, label: period.label,
      status: "CLOSED", closedBy: userId ?? null, closedAt: new Date(),
    },
  });

  await ensureOpenPeriod(companyId, nextCutoff(period));
  return { ok: true };
}
