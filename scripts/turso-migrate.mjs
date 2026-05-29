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

  // OTApproval table
  if (await tableExists("OTApproval")) {
    console.log("  skip OTApproval table (exists)");
  } else {
    await db.execute(`
      CREATE TABLE "OTApproval" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "companyId"   TEXT NOT NULL,
        "periodStart" DATETIME NOT NULL,
        "periodEnd"   DATETIME NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'PENDING',
        "preparedBy"  TEXT NOT NULL DEFAULT 'Ailyn',
        "preparedAt"  DATETIME,
        "checkedBy"   TEXT NOT NULL DEFAULT 'Angela',
        "checkedAt"   DATETIME,
        "approvedBy"  TEXT NOT NULL DEFAULT 'Louie',
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

  console.log("Turso migration: done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Turso migration failed:", err);
  process.exit(1);
});
