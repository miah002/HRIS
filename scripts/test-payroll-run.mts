/**
 * Live integration test for the runPayroll de-N+1 refactor mechanics:
 *   - bulk `employeeId: { in: [...] }` reads return the right rows per employee
 *   - grouping into per-employee maps does not cross-contaminate
 *   - a batched prisma.$transaction([...upserts]) commits and reads back correctly
 * (The pay math itself is covered by the 59 unit tests.)
 */
import { prisma } from "@/lib/prisma";

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
};

async function main() {
  await prisma.attendance.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.company.deleteMany({});

  const company = await prisma.company.create({ data: { name: "Run Co" } });
  const mk = (n: string, rate: number) => prisma.employee.create({
    data: { companyId: company.id, employeeNumber: n, firstName: n, lastName: "T", position: "Staff", department: "Ops", employmentStatus: "REGULAR", basicMonthlyRate: rate, dateHired: new Date(2020, 0, 1) },
  });
  const a = await mk("A", 21750);
  const b = await mk("B", 30000);
  const start = new Date(2026, 5, 26), end = new Date(2026, 6, 10);

  // Distinct attendance per employee.
  await prisma.attendance.create({ data: { employeeId: a.id, date: new Date("2026-06-26T00:00:00"), hoursWorked: 8, otRateCode: "RD" } });
  await prisma.attendance.create({ data: { employeeId: b.id, date: new Date("2026-06-29T00:00:00"), hoursWorked: 8 } });

  const empIds = [a.id, b.id];

  // Bulk read + group (mirrors runPayroll).
  const allAttendance = await prisma.attendance.findMany({ where: { employeeId: { in: empIds }, date: { gte: start, lte: end } } });
  const attByEmp = new Map<string, typeof allAttendance>();
  for (const r of allAttendance) { const l = attByEmp.get(r.employeeId) ?? []; l.push(r); attByEmp.set(r.employeeId, l); }

  check("bulk in-query returns both employees' rows", allAttendance.length === 2, `got ${allAttendance.length}`);
  check("employee A grouped to their own RD row", (attByEmp.get(a.id) ?? []).every((r) => r.otRateCode === "RD") && attByEmp.get(a.id)!.length === 1);
  check("employee B grouped to their own plain row (no cross-contamination)", (attByEmp.get(b.id) ?? []).length === 1 && attByEmp.get(b.id)![0].otRateCode === null);

  // Batched transaction of two upserts.
  const writes = [a, b].map((e) =>
    prisma.payroll.upsert({
      where: { employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart: start, periodEnd: end } },
      update: { basicPay: e.basicMonthlyRate / 2, grossPay: e.basicMonthlyRate / 2, totalDeductions: 0, netPay: e.basicMonthlyRate / 2, status: "DRAFT" },
      create: { employeeId: e.id, periodStart: start, periodEnd: end, basicPay: e.basicMonthlyRate / 2, grossPay: e.basicMonthlyRate / 2, totalDeductions: 0, netPay: e.basicMonthlyRate / 2, status: "DRAFT" },
    }),
  );
  await prisma.$transaction(writes);

  const back = await prisma.payroll.findMany({ where: { employeeId: { in: empIds }, periodStart: start }, orderBy: { basicPay: "asc" } });
  check("batched $transaction wrote both payroll rows", back.length === 2, `got ${back.length}`);
  check("each row kept its own employee's basic pay (A=10875, B=15000)",
    back.some((p) => p.employeeId === a.id && p.basicPay === 10875) && back.some((p) => p.employeeId === b.id && p.basicPay === 15000));

  console.log(failures === 0 ? "\n✅ ALL PAYROLL-RUN MECHANICS PASSED\n" : `\n❌ ${failures} CHECK(S) FAILED\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
