/**
 * Live integration test for absence detection against a throwaway SQLite DB.
 * Verifies the runPayroll wiring: attendance dates round-trip through Prisma,
 * paid/unpaid leave ranges expand correctly, holidays/weekends are excluded,
 * and the "timekept" guard spares employees with no attendance.
 */
import { prisma } from "@/lib/prisma";
import { countUnpaidAbsenceDays, phDayKey } from "@/lib/ph-payroll";
import { getPHHoliday } from "@/lib/ph-holidays";

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
};

// Replicates the absence snippet in runPayroll() so we exercise the real data path.
async function absentDaysFor(employeeId: string, start: Date, end: Date) {
  const attendance = await prisma.attendance.findMany({ where: { employeeId, date: { gte: start, lte: end } } });
  const isTimekept = attendance.length > 0;
  const presentDays = new Set(attendance.filter((a) => a.hoursWorked > 0).map((a) => phDayKey(a.date)));
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: { employeeId, status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true, isWithPay: true },
  });
  const paidLeaveDays = new Set<string>();
  for (const lv of approvedLeaves) {
    if (!lv.isWithPay) continue;
    const from = lv.startDate < start ? start : lv.startDate;
    const to = lv.endDate > end ? end : lv.endDate;
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const last = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    while (d.getTime() <= last) { paidLeaveDays.add(phDayKey(d)); d.setDate(d.getDate() + 1); }
  }
  return isTimekept
    ? countUnpaidAbsenceDays({ periodStart: start, periodEnd: end, presentDays, paidLeaveDays, isHoliday: (d) => getPHHoliday(d) !== null })
    : 0;
}

async function main() {
  await prisma.attendance.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.company.deleteMany({});

  const company = await prisma.company.create({ data: { name: "Abs Co" } });
  const mk = (n: string) => prisma.employee.create({
    data: { companyId: company.id, employeeNumber: n, firstName: n, lastName: "T", position: "Staff", department: "Ops", employmentStatus: "REGULAR", basicMonthlyRate: 21750, dateHired: new Date(2020, 0, 1) },
  });
  const timekept = await mk("TK");
  const salaried = await mk("SAL"); // no attendance at all

  const start = new Date(2026, 5, 11), end = new Date(2026, 5, 25); // Jun 11–25 2026

  // Date-key round-trip: store midnight date the way the app does, read it back.
  const probe = await prisma.attendance.create({
    data: { employeeId: timekept.id, date: new Date("2026-06-15T00:00:00"), hoursWorked: 8 },
  });
  check("attendance date round-trips to the same calendar day", phDayKey(probe.date) === "2026-06-15", `got ${phDayKey(probe.date)}`);

  // Present Jun 16, 17 (weekdays) + Jun 13 (Saturday rest-day work — must NOT reduce absences).
  for (const d of ["2026-06-16", "2026-06-17", "2026-06-13"]) {
    await prisma.attendance.create({ data: { employeeId: timekept.id, date: new Date(d + "T00:00:00"), hoursWorked: 8 } });
  }
  // Paid leave Jun 18; unpaid leave Jun 19.
  await prisma.leaveRequest.create({ data: { employeeId: timekept.id, leaveType: "VL", status: "APPROVED", isWithPay: true,  startDate: new Date("2026-06-18T00:00:00"), endDate: new Date("2026-06-18T00:00:00") } });
  await prisma.leaveRequest.create({ data: { employeeId: timekept.id, leaveType: "LWOP", status: "APPROVED", isWithPay: false, startDate: new Date("2026-06-19T00:00:00"), endDate: new Date("2026-06-19T00:00:00") } });

  // Expected workdays Jun 11–25 (excl. weekends + Jun 12 RH): 11,15,16,17,18,19,22,23,24,25 = 10.
  // Present {15,16,17}; paid leave {18}; → absent = {11,19,22,23,24,25} = 6 (incl. the unpaid-leave day 19).
  const tkAbsent = await absentDaysFor(timekept.id, start, end);
  check("timekept employee: 6 unpaid days (Sat work & paid leave excluded; unpaid leave included)", tkAbsent === 6, `got ${tkAbsent}`);

  const salAbsent = await absentDaysFor(salaried.id, start, end);
  check("salaried employee with no attendance: 0 (fixed half-month preserved)", salAbsent === 0, `got ${salAbsent}`);

  console.log(failures === 0 ? "\n✅ ALL ABSENCE CHECKS PASSED\n" : `\n❌ ${failures} CHECK(S) FAILED\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
