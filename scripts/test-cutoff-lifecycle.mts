/**
 * Live integration test for the cutoff lifecycle against a throwaway SQLite DB.
 * Proves:
 *   A. activeCutoff() follows the OPEN PayrollPeriod, NOT the calendar date.
 *   B. closeCutoff() marks the period CLOSED and advances to the next cutoff.
 *   C. closeCutoff() refuses while DRAFT payroll rows exist (DRAFTS_EXIST guard).
 *
 * Run with DATABASE_URL pointed at a temp db (see the npm-less runner below).
 */
import { prisma } from "@/lib/prisma";
import { activeCutoff, ensureOpenPeriod, closeCutoff } from "@/lib/payroll-period";
import { cutoffForDate } from "@/lib/cutoff";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  const mark = cond ? "✓" : "✗";
  if (!cond) failures++;
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function main() {
  // Clean slate
  await prisma.payroll.deleteMany({});
  await prisma.payrollPeriod.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.company.deleteMany({});

  const company = await prisma.company.create({ data: { name: "Test Co" } });
  const emp = await prisma.employee.create({
    data: {
      companyId: company.id, employeeNumber: "T-001",
      firstName: "Test", lastName: "Worker",
      position: "Staff", department: "Ops",
      employmentStatus: "REGULAR", basicMonthlyRate: 20000,
      dateHired: new Date(2020, 0, 1),
    },
  });

  // Today is 2026-06-12 → date-derived cutoff = Jun 11–25.
  const dateDerived = cutoffForDate(new Date(2026, 5, 12));
  console.log(`\nToday's date-derived cutoff: ${dateDerived.label} (${ymd(dateDerived.start)}–${ymd(dateDerived.end)})`);

  // --- A. activeCutoff follows OPEN period, not the calendar ---
  console.log("\nA. current cutoff = the OPEN period, not the calendar date");
  // Open a PAST cutoff (May 26 – Jun 10) deliberately different from today's.
  const pastCutoff = { start: new Date(2026, 4, 26), end: new Date(2026, 5, 10), label: "26–10" };
  await ensureOpenPeriod(company.id, pastCutoff);
  const active1 = await activeCutoff(company.id);
  check("activeCutoff returns the OPEN May 26–Jun 10 period",
    ymd(active1.start) === ymd(pastCutoff.start) && ymd(active1.end) === ymd(pastCutoff.end),
    `got ${active1.label} ${ymd(active1.start)}–${ymd(active1.end)}`);
  check("activeCutoff does NOT return today's calendar cutoff (Jun 11–25)",
    ymd(active1.start) !== ymd(dateDerived.start));

  // --- C. (tested first) DRAFTS_EXIST guard blocks close ---
  console.log("\nC. closing is blocked while DRAFT payroll exists");
  await prisma.payroll.create({
    data: {
      employeeId: emp.id, periodStart: pastCutoff.start, periodEnd: pastCutoff.end,
      basicPay: 10000, grossPay: 10000, totalDeductions: 0, netPay: 10000, status: "DRAFT",
    },
  });
  const blocked = await closeCutoff(company.id, pastCutoff, undefined);
  check("closeCutoff refuses with reason DRAFTS_EXIST", blocked.ok === false && blocked.reason === "DRAFTS_EXIST",
    `got ${JSON.stringify(blocked)}`);
  const stillActive = await activeCutoff(company.id);
  check("active cutoff unchanged after blocked close",
    ymd(stillActive.start) === ymd(pastCutoff.start));

  // --- B. release the draft, then close advances exactly one period ---
  console.log("\nB. closing advances to the next cutoff");
  await prisma.payroll.updateMany({ where: { status: "DRAFT" }, data: { status: "RELEASED" } });
  const closed = await closeCutoff(company.id, pastCutoff, "tester");
  check("closeCutoff succeeds once no DRAFTs remain", closed.ok === true, JSON.stringify(closed));

  const closedRow = await prisma.payrollPeriod.findFirst({
    where: { companyId: company.id, periodStart: pastCutoff.start }, select: { status: true },
  });
  check("previous period is now CLOSED", closedRow?.status === "CLOSED", `status=${closedRow?.status}`);

  const active2 = await activeCutoff(company.id);
  check("active cutoff advanced to Jun 11–25 (nextCutoff of May 26–Jun 10)",
    ymd(active2.start) === "2026-06-11" && ymd(active2.end) === "2026-06-25",
    `got ${active2.label} ${ymd(active2.start)}–${ymd(active2.end)}`);

  // close again → should advance to Jun 26 – Jul 10
  await closeCutoff(company.id, { start: active2.start, end: active2.end, label: active2.label }, "tester");
  const active3 = await activeCutoff(company.id);
  check("closing again advances to Jun 26–Jul 10",
    ymd(active3.start) === "2026-06-26" && ymd(active3.end) === "2026-07-10",
    `got ${active3.label} ${ymd(active3.start)}–${ymd(active3.end)}`);

  // Only one OPEN period should ever exist at a time
  const openCount = await prisma.payrollPeriod.count({ where: { companyId: company.id, status: "OPEN" } });
  check("exactly one OPEN period exists at any time", openCount === 1, `openCount=${openCount}`);

  console.log(failures === 0 ? "\n✅ ALL CUTOFF LIFECYCLE CHECKS PASSED\n" : `\n❌ ${failures} CHECK(S) FAILED\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
