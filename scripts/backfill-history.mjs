/**
 * One-time backfill: create synthetic HIRED EmployeeHistory for each employee
 * that has zero history records. Uses a deterministic id for idempotency.
 *
 * Local dev: node scripts/backfill-history.mjs
 * Production: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/backfill-history.mjs
 */

import { createClient } from "@libsql/client";

const url   = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

let db;
if (url && token) {
  db = createClient({ url, authToken: token });
  console.log("Connected to Turso production DB.");
} else {
  // Local SQLite fallback via libsql
  const localUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  db = createClient({ url: localUrl.replace("file:", "file://") });
  console.log(`Connected to local SQLite: ${localUrl}`);
}

async function main() {
  // Fetch all non-archived employees
  const employees = await db.execute(
    `SELECT id, firstName, lastName, employeeNumber, position, department, basicMonthlyRate, dateHired
     FROM Employee WHERE archived = 0`
  );

  let created = 0;
  let skipped = 0;

  for (const emp of employees.rows) {
    // Check if they already have history
    const existing = await db.execute(
      `SELECT id FROM EmployeeHistory WHERE employeeId = ? LIMIT 1`,
      [emp.id]
    );
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    const syntheticId = `${emp.id}-hired`;
    const rate = Number(emp.basicMonthlyRate).toLocaleString();
    const toValue = `${emp.position} · ${emp.department} · ₱${rate}`;

    await db.execute(
      `INSERT OR IGNORE INTO EmployeeHistory
         (id, employeeId, type, effectiveDate, toValue, createdAt)
       VALUES (?, ?, 'HIRED', ?, ?, CURRENT_TIMESTAMP)`,
      [syntheticId, emp.id, emp.dateHired, toValue]
    );
    created++;
    console.log(`  backfilled: ${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`);
  }

  console.log(`Done. Created ${created} HIRED entries. Skipped ${skipped} (already had history).`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
