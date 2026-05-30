/**
 * Idempotent schema migration for Turso (libSQL).
 * Run during Vercel build to ensure all columns/tables exist.
 * Safe to run on every deploy — skips columns/tables that already exist.
 */

import { createClient } from "@libsql/client";

const url   = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url || !token) {
  console.log("No TURSO_DATABASE_URL/TURSO_AUTH_TOKEN — skipping Turso migration (local dev).");
  process.exit(0);
}

const db = createClient({ url, authToken: token });

async function columnExists(table, column) {
  const res = await db.execute(`PRAGMA table_info("${table}")`);
  return res.rows.some((r) => r.name === column);
}

async function tableExists(table) {
  const res = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [table]
  );
  return res.rows.length > 0;
}

async function addColumnIfMissing(table, column, type) {
  if (await columnExists(table, column)) {
    console.log(`  skip ${table}.${column} (exists)`);
    return;
  }
  await db.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
  console.log(`  added ${table}.${column}`);
}

async function main() {
  console.log("Turso migration: checking schema...");

  // Seed MMTSI company name/address if not yet set
  const co = await db.execute(`SELECT id, name, address FROM "Company" LIMIT 1`);
  if (co.rows.length > 0) {
    const row = co.rows[0];
    const needsUpdate = !row.name || row.name === "Company" || !row.address;
    if (needsUpdate) {
      await db.execute(
        `UPDATE "Company" SET "name"=?, "address"=? WHERE "id"=?`,
        ["Makiling Management Technology Systems, Inc.", "Sto. Tomas, Batangas, Phils.", row.id]
      );
      console.log("  Seeded MMTSI company name and address.");
    } else {
      console.log(`  Company already set: ${row.name}`);
    }
  }

  // User OT permission flags
  await addColumnIfMissing("User", "canPrepareOT", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("User", "canCheckOT",   "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("User", "canApproveOT", "INTEGER NOT NULL DEFAULT 0");

  // Employee additions
  await addColumnIfMissing("Employee", "hdmfMp2Monthly",   "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Employee", "addressStreet",    "TEXT");
  await addColumnIfMissing("Employee", "addressCity",      "TEXT");
  await addColumnIfMissing("Employee", "addressProvince",  "TEXT");
  await addColumnIfMissing("Employee", "addressZip",       "TEXT");
  await addColumnIfMissing("Employee", "separationDate",   "DATETIME");
  await addColumnIfMissing("Employee", "separationType",   "TEXT");
  await addColumnIfMissing("Employee", "separationNotes",  "TEXT");

  // Payroll additions
  await addColumnIfMissing("Payroll", "absenceDeduction",     "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "sssLoanDeduction",     "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "hdmfLoanDeduction",    "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "cashAdvanceDeduction", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "lateMinutes",          "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "lateDeduction",       "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "undertimeMinutes",    "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "undertimeDeduction",  "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "hdmfMp2",             "REAL NOT NULL DEFAULT 0");

  // LeaveRequest additions (WITH PAY workflow)
  await addColumnIfMissing("LeaveRequest", "isWithPay",  "INTEGER NOT NULL DEFAULT 1");
  await addColumnIfMissing("LeaveRequest", "approvedBy", "TEXT");
  await addColumnIfMissing("LeaveRequest", "approvedAt", "DATETIME");

  // OTApproval table — preparedBy/checkedBy/approvedBy are nullable (no hardcoded defaults)
  if (await tableExists("OTApproval")) {
    // Fix: if old table has hardcoded NOT NULL defaults on workflow fields, recreate it
    const otaCols = await db.execute(`PRAGMA table_info("OTApproval")`);
    const preparedByCol = otaCols.rows.find(r => r.name === "preparedBy");
    if (preparedByCol && preparedByCol.notnull === 1) {
      console.log("  OTApproval: fixing hardcoded name defaults → nullable...");
      const existing = await db.execute(`SELECT * FROM "OTApproval"`);
      await db.execute(`DROP TABLE "OTApproval"`);
      await db.execute(`
        CREATE TABLE "OTApproval" (
          "id"          TEXT NOT NULL PRIMARY KEY,
          "companyId"   TEXT NOT NULL,
          "periodStart" DATETIME NOT NULL,
          "periodEnd"   DATETIME NOT NULL,
          "status"      TEXT NOT NULL DEFAULT 'PENDING',
          "preparedBy"  TEXT,
          "preparedAt"  DATETIME,
          "checkedBy"   TEXT,
          "checkedAt"   DATETIME,
          "approvedBy"  TEXT,
          "approvedAt"  DATETIME,
          "notes"       TEXT,
          "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "OTApproval_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
            ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);
      await db.execute(`
        CREATE UNIQUE INDEX "OTApproval_companyId_periodStart_periodEnd_key"
          ON "OTApproval" ("companyId", "periodStart", "periodEnd")
      `);
      for (const row of existing.rows) {
        await db.execute(
          `INSERT INTO "OTApproval" VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [row.id, row.companyId, row.periodStart, row.periodEnd, row.status,
           row.preparedBy || null, row.preparedAt || null,
           row.checkedBy || null, row.checkedAt || null,
           row.approvedBy || null, row.approvedAt || null,
           row.notes || null, row.createdAt]
        );
      }
      console.log(`  OTApproval: recreated with nullable fields (${existing.rows.length} rows preserved)`);
    } else {
      console.log("  skip OTApproval table (already correct)");
    }
  } else {
    await db.execute(`
      CREATE TABLE "OTApproval" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "companyId"   TEXT NOT NULL,
        "periodStart" DATETIME NOT NULL,
        "periodEnd"   DATETIME NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'PENDING',
        "preparedBy"  TEXT,
        "preparedAt"  DATETIME,
        "checkedBy"   TEXT,
        "checkedAt"   DATETIME,
        "approvedBy"  TEXT,
        "approvedAt"  DATETIME,
        "notes"       TEXT,
        "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OTApproval_companyId_fkey"
          FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
          ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await db.execute(`
      CREATE UNIQUE INDEX "OTApproval_companyId_periodStart_periodEnd_key"
        ON "OTApproval" ("companyId", "periodStart", "periodEnd")
    `);
    console.log("  created OTApproval table");
  }

  // Performance indexes (idempotent — IF NOT EXISTS)
  await db.execute(`CREATE INDEX IF NOT EXISTS "idx_leave_emp_status" ON "LeaveRequest"("employeeId","status")`);
  await db.execute(`CREATE INDEX IF NOT EXISTS "idx_leave_period" ON "LeaveRequest"("employeeId","startDate","endDate")`);
  await db.execute(`CREATE INDEX IF NOT EXISTS "idx_loan_emp_status" ON "Loan"("employeeId","status")`);
  await db.execute(`CREATE INDEX IF NOT EXISTS "idx_employee_company" ON "Employee"("companyId","archived")`);
  await db.execute(`CREATE INDEX IF NOT EXISTS "idx_payroll_period" ON "Payroll"("periodStart","periodEnd")`);
  await db.execute(`CREATE INDEX IF NOT EXISTS "idx_attendance_emp" ON "Attendance"("employeeId")`);
  console.log("  performance indexes ensured");

  // EmergencyContact table
  if (!(await tableExists("EmergencyContact"))) {
    await db.execute(`CREATE TABLE "EmergencyContact" (
      "id"           TEXT NOT NULL PRIMARY KEY,
      "employeeId"   TEXT NOT NULL,
      "name"         TEXT NOT NULL,
      "relationship" TEXT NOT NULL,
      "phone"        TEXT NOT NULL,
      "email"        TEXT,
      "isPrimary"    INTEGER NOT NULL DEFAULT 0,
      "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmergencyContact_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    console.log("  created EmergencyContact table");
  } else {
    console.log("  skip EmergencyContact table (exists)");
  }

  // EmployeeHistory table
  if (!(await tableExists("EmployeeHistory"))) {
    await db.execute(`CREATE TABLE "EmployeeHistory" (
      "id"            TEXT NOT NULL PRIMARY KEY,
      "employeeId"    TEXT NOT NULL,
      "type"          TEXT NOT NULL,
      "effectiveDate" DATETIME NOT NULL,
      "field"         TEXT,
      "fromValue"     TEXT,
      "toValue"       TEXT,
      "notes"         TEXT,
      "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmployeeHistory_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await db.execute(`CREATE INDEX "EmployeeHistory_emp_date_idx"
      ON "EmployeeHistory" ("employeeId", "effectiveDate" DESC)`);
    console.log("  created EmployeeHistory table");
  } else {
    console.log("  skip EmployeeHistory table (exists)");
  }

  // One-time data cleanup
  await db.execute("DELETE FROM LeaveRequest WHERE leaveType = 'SIL'");
  await db.execute(`DELETE FROM LeaveRequest WHERE leaveType = 'PATERNITY'
    AND employeeId IN (SELECT id FROM Employee WHERE sex = 'FEMALE' OR sex IS NULL AND lastName = 'Veloso')`);
  console.log("  cleaned up SIL and invalid PATERNITY records");

  // Backfill HIRED EmployeeHistory for employees with no history
  const employees = await db.execute(
    `SELECT id, firstName, lastName, employeeNumber, position, department, basicMonthlyRate, dateHired
     FROM Employee WHERE archived = 0`
  );
  let backfilled = 0;
  for (const emp of employees.rows) {
    const existing = await db.execute(
      `SELECT id FROM EmployeeHistory WHERE employeeId = ? LIMIT 1`,
      [emp.id]
    );
    if (existing.rows.length > 0) continue;
    const rate = Number(emp.basicMonthlyRate).toLocaleString("en-PH");
    const toValue = `${emp.position} · ${emp.department} · ₱${rate}`;
    await db.execute(
      `INSERT OR IGNORE INTO EmployeeHistory
         (id, employeeId, type, effectiveDate, toValue, createdAt)
       VALUES (?, ?, 'HIRED', ?, ?, CURRENT_TIMESTAMP)`,
      [`${emp.id}-hired`, emp.id, emp.dateHired, toValue]
    );
    backfilled++;
    console.log(`  backfilled HIRED: ${emp.firstName} ${emp.lastName}`);
  }
  if (backfilled === 0) console.log("  backfill: all employees already have history");
  else console.log(`  backfill: created ${backfilled} HIRED entries`);

  // ── Fix old 1-15 / 16-end periods → correct 11-25 / 26-10 MMTSI schedule ──
  console.log("Checking for old-style 1-15/16-end payroll periods...");
  await fixPayrollPeriodDates();

  console.log("Turso migration: done.");
  process.exit(0);
}

async function fixPayrollPeriodDates() {
  // Find all distinct old-style periods (day 1 = old first half, day 16 = old second half)
  const res = await db.execute(`
    SELECT DISTINCT "periodStart", "periodEnd"
    FROM "Payroll"
    WHERE CAST(strftime('%d', "periodStart") AS INTEGER) IN (1, 16)
  `);

  if (res.rows.length === 0) {
    console.log("  No old-style payroll periods found — nothing to fix.");
  } else {
    // Group old periods by computed new target, track total gross to keep best data
    const targetMap = new Map();
    for (const row of res.rows) {
      const oldStart = new Date(row.periodStart);
      const day = oldStart.getUTCDate();
      const newStart = new Date(oldStart);
      const newEnd   = new Date(oldStart);
      if (day === 1) {
        newStart.setUTCDate(11); newEnd.setUTCDate(25);
      } else {
        newStart.setUTCDate(26);
        newEnd.setUTCMonth(newEnd.getUTCMonth() + 1); newEnd.setUTCDate(10);
      }
      const key = newStart.toISOString();
      if (!targetMap.has(key)) targetMap.set(key, []);
      const grossRes = await db.execute(
        `SELECT COALESCE(SUM("grossPay"), 0) AS total FROM "Payroll" WHERE "periodStart"=? AND "periodEnd"=?`,
        [row.periodStart, row.periodEnd]
      );
      targetMap.get(key).push({
        oldStart: row.periodStart, oldEnd: row.periodEnd,
        newStart: newStart.toISOString(), newEnd: newEnd.toISOString(),
        total: Number(grossRes.rows[0]?.total ?? 0),
      });
    }

    for (const [, periods] of targetMap) {
      for (const p of periods) {
        // Check if correct-dated records already exist (e.g. payroll re-run after cutoff fix)
        const existingRes = await db.execute(
          `SELECT COALESCE(SUM("grossPay"), 0) AS total FROM "Payroll" WHERE "periodStart"=? AND "periodEnd"=?`,
          [p.newStart, p.newEnd]
        );
        const existingTotal = Number(existingRes.rows[0]?.total ?? 0);

        if (existingTotal >= p.total) {
          // Correct-dated records are equal or better — just remove the old ones
          await db.execute(
            `DELETE FROM "Payroll" WHERE "periodStart"=? AND "periodEnd"=?`,
            [p.oldStart, p.oldEnd]
          );
          console.log(`  Payroll: deleted stale ${p.oldStart.slice(0,10)} (₱${p.total.toFixed(0)}) — kept existing at ${p.newStart.slice(0,10)} (₱${existingTotal.toFixed(0)})`);
        } else {
          // Old records are better (higher gross) — replace target with old
          await db.execute(
            `DELETE FROM "Payroll" WHERE "periodStart"=? AND "periodEnd"=?`,
            [p.newStart, p.newEnd]
          );
          await db.execute(
            `UPDATE "Payroll" SET "periodStart"=?, "periodEnd"=? WHERE "periodStart"=? AND "periodEnd"=?`,
            [p.newStart, p.newEnd, p.oldStart, p.oldEnd]
          );
          console.log(`  Payroll: ${p.oldStart.slice(0,10)} → ${p.newStart.slice(0,10)} (₱${p.total.toFixed(0)} > existing ₱${existingTotal.toFixed(0)})`);
        }
      }
    }
  }

  // Fix OTApproval dates too
  const otRes = await db.execute(`
    SELECT DISTINCT "periodStart", "periodEnd", "companyId"
    FROM "OTApproval"
    WHERE CAST(strftime('%d', "periodStart") AS INTEGER) IN (1, 16)
  `);
  for (const row of otRes.rows) {
    const oldStart = new Date(row.periodStart);
    const day = oldStart.getUTCDate();
    const newStart = new Date(oldStart); const newEnd = new Date(oldStart);
    if (day === 1) { newStart.setUTCDate(11); newEnd.setUTCDate(25); }
    else { newStart.setUTCDate(26); newEnd.setUTCMonth(newEnd.getUTCMonth()+1); newEnd.setUTCDate(10); }
    const ns = newStart.toISOString(), ne = newEnd.toISOString();
    await db.execute(
      `DELETE FROM "OTApproval" WHERE "periodStart"=? AND "periodEnd"=? AND "companyId"=?`,
      [ns, ne, row.companyId]
    );
    await db.execute(
      `UPDATE "OTApproval" SET "periodStart"=?, "periodEnd"=? WHERE "periodStart"=? AND "periodEnd"=? AND "companyId"=?`,
      [ns, ne, row.periodStart, row.periodEnd, row.companyId]
    );
    console.log(`  OTApproval: fixed ${row.periodStart.slice(0,10)} → ${ns.slice(0,10)}`);
  }
}

main().catch((err) => {
  console.error("Turso migration failed:", err);
  process.exit(1);
});
