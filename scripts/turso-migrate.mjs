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

  // Employee additions
  await addColumnIfMissing("Employee", "hdmfMp2Monthly", "REAL NOT NULL DEFAULT 0");

  // Payroll additions
  await addColumnIfMissing("Payroll", "lateMinutes",         "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "lateDeduction",       "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "undertimeMinutes",    "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "undertimeDeduction",  "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Payroll", "hdmfMp2",             "REAL NOT NULL DEFAULT 0");

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

  console.log("Turso migration: done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Turso migration failed:", err);
  process.exit(1);
});
