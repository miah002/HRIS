/**
 * One-time backfill: create synthetic HIRED EmployeeHistory for each employee
 * that has zero history records. Uses a deterministic id for idempotency.
 *
 * Run: node scripts/backfill-history.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    include: { history: { take: 1 } },
  });

  let created = 0;
  for (const emp of employees) {
    if (emp.history.length > 0) continue;

    await prisma.employeeHistory.upsert({
      where: { id: `${emp.id}-hired` },
      update: {},
      create: {
        id: `${emp.id}-hired`,
        employeeId: emp.id,
        type: "HIRED",
        effectiveDate: emp.dateHired,
        toValue: `${emp.position} · ${emp.department} · ₱${emp.basicMonthlyRate.toLocaleString()}`,
      },
    });
    created++;
    console.log(`  backfilled: ${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`);
  }

  console.log(`Done. Created ${created} HIRED entries.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
