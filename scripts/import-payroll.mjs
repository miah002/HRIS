/**
 * Import historical payroll data from Excel into Turso.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/import-payroll.mjs payroll-2026-jan.xlsx
 *   node scripts/import-payroll.mjs payroll.xlsx --dry-run   (preview only, no writes)
 *
 * Excel column headers (row 1):
 *
 *   REQUIRED:
 *     employeeNumber  — e.g. MMTSI2019-002
 *     periodStart     — YYYY-MM-DD  e.g. 2026-01-11
 *     periodEnd       — YYYY-MM-DD  e.g. 2026-01-25
 *     basicPay        — numeric
 *     grossPay        — numeric
 *     totalDeductions — numeric
 *     netPay          — numeric
 *
 *   OPTIONAL (defaults to 0 if missing):
 *     overtimePay, nightDiffPay, holidayPay, allowances
 *     taxableAdjustments, nonTaxableAdjustments
 *     sssEE, sssER
 *     philHealthEE, philHealthER
 *     pagIbigEE, pagIbigER
 *     withholdingTax
 *     loanDeductions, otherDeductions
 *     absenceDeduction, lateDeduction, undertimeDeduction
 *     lateMinutes, undertimeMinutes
 *     daysWorked, regularHours
 *     hdmfMp2, sssLoanDeduction, hdmfLoanDeduction, cashAdvanceDeduction
 *
 * All imported records are set to status=RELEASED.
 * Records for the same employee+period that already exist are SKIPPED.
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import { randomUUID } from "crypto";

const filePath = process.argv[2];
const dryRun   = process.argv.includes("--dry-run");

if (!filePath) {
  console.error("Usage: node scripts/import-payroll.mjs <file.xlsx> [--dry-run]");
  process.exit(1);
}

const url   = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url || !token) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const db = createClient({ url, authToken: token });

// ── helpers ──────────────────────────────────────────────────────────────────

function n(row, col, def = 0) {
  const v = row[col];
  if (v === undefined || v === null || v === "") return def;
  const num = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(num) ? def : Math.round(num * 100) / 100;
}

function toIso(val) {
  if (!val) throw new Error("Missing date value");
  // Excel serial number
  if (typeof val === "number") {
    const d = utils.numToDate ? utils.numToDate(val) : new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().replace(/T.*/, "T00:00:00.000Z");
  }
  // String like "2026-01-11" or "01/11/2026"
  const s = String(val).trim();
  const iso = s.match(/^\d{4}-\d{2}-\d{2}$/) ? s : new Date(s).toISOString().slice(0, 10);
  return `${iso}T00:00:00.000Z`;
}

// ── load Excel ────────────────────────────────────────────────────────────────

const wb    = read(readFileSync(filePath));
const ws    = wb.Sheets[wb.SheetNames[0]];
const rows  = utils.sheet_to_json(ws, { defval: "" });

console.log(`Loaded ${rows.length} rows from ${filePath}${dryRun ? " [DRY RUN]" : ""}`);

// ── load employees ────────────────────────────────────────────────────────────

const empRes = await db.execute("SELECT id, employeeNumber FROM Employee");
const empMap = new Map(empRes.rows.map((e) => [String(e.employeeNumber), String(e.id)]));

console.log(`Employees in DB: ${empMap.size}`);

// ── existing payroll keys (to skip duplicates) ────────────────────────────────

const existRes = await db.execute(
  "SELECT employeeId, periodStart FROM Payroll"
);
const existKeys = new Set(
  existRes.rows.map((r) => `${r.employeeId}|${String(r.periodStart).slice(0, 10)}`)
);

// ── process rows ──────────────────────────────────────────────────────────────

let inserted = 0, skipped = 0, errors = 0;

for (const [i, row] of rows.entries()) {
  const rowNum = i + 2; // 1-indexed + header row

  try {
    const empNum = String(row["employeeNumber"] ?? "").trim();
    if (!empNum) { console.warn(`Row ${rowNum}: missing employeeNumber — skipped`); errors++; continue; }

    const empId = empMap.get(empNum);
    if (!empId) { console.warn(`Row ${rowNum}: unknown employee ${empNum} — skipped`); errors++; continue; }

    const periodStart = toIso(row["periodStart"]);
    const periodEnd   = toIso(row["periodEnd"]);

    const key = `${empId}|${periodStart.slice(0, 10)}`;
    if (existKeys.has(key)) {
      console.log(`Row ${rowNum}: ${empNum} ${periodStart.slice(0, 10)} already exists — skipped`);
      skipped++;
      continue;
    }

    const record = {
      id:                    randomUUID(),
      employeeId:            empId,
      periodStart,
      periodEnd,
      status:                "RELEASED",
      daysWorked:            n(row, "daysWorked"),
      regularHours:          n(row, "regularHours"),
      basicPay:              n(row, "basicPay"),
      overtimePay:           n(row, "overtimePay"),
      nightDiffPay:          n(row, "nightDiffPay"),
      holidayPay:            n(row, "holidayPay"),
      allowances:            n(row, "allowances"),
      taxableAdjustments:    n(row, "taxableAdjustments"),
      nonTaxableAdjustments: n(row, "nonTaxableAdjustments"),
      grossPay:              n(row, "grossPay"),
      sssEE:                 n(row, "sssEE"),
      sssER:                 n(row, "sssER"),
      philHealthEE:          n(row, "philHealthEE"),
      philHealthER:          n(row, "philHealthER"),
      pagIbigEE:             n(row, "pagIbigEE"),
      pagIbigER:             n(row, "pagIbigER"),
      withholdingTax:        n(row, "withholdingTax"),
      loanDeductions:        n(row, "loanDeductions"),
      otherDeductions:       n(row, "otherDeductions"),
      absenceDeduction:      n(row, "absenceDeduction"),
      lateMinutes:           n(row, "lateMinutes"),
      lateDeduction:         n(row, "lateDeduction"),
      undertimeMinutes:      n(row, "undertimeMinutes"),
      undertimeDeduction:    n(row, "undertimeDeduction"),
      hdmfMp2:               n(row, "hdmfMp2"),
      sssLoanDeduction:      n(row, "sssLoanDeduction"),
      hdmfLoanDeduction:     n(row, "hdmfLoanDeduction"),
      cashAdvanceDeduction:  n(row, "cashAdvanceDeduction"),
      totalDeductions:       n(row, "totalDeductions"),
      netPay:                n(row, "netPay"),
    };

    if (dryRun) {
      console.log(`[DRY RUN] Would insert: ${empNum} | ${periodStart.slice(0,10)}→${periodEnd.slice(0,10)} | gross:${record.grossPay} net:${record.netPay}`);
      inserted++;
      continue;
    }

    await db.execute({
      sql: `INSERT INTO Payroll (
        id, employeeId, periodStart, periodEnd, status,
        daysWorked, regularHours,
        basicPay, overtimePay, nightDiffPay, holidayPay, allowances,
        taxableAdjustments, nonTaxableAdjustments, grossPay,
        sssEE, sssER, philHealthEE, philHealthER, pagIbigEE, pagIbigER,
        withholdingTax, loanDeductions, otherDeductions,
        absenceDeduction, lateMinutes, lateDeduction,
        undertimeMinutes, undertimeDeduction, hdmfMp2,
        sssLoanDeduction, hdmfLoanDeduction, cashAdvanceDeduction,
        totalDeductions, netPay, createdAt
      ) VALUES (
        :id, :employeeId, :periodStart, :periodEnd, :status,
        :daysWorked, :regularHours,
        :basicPay, :overtimePay, :nightDiffPay, :holidayPay, :allowances,
        :taxableAdjustments, :nonTaxableAdjustments, :grossPay,
        :sssEE, :sssER, :philHealthEE, :philHealthER, :pagIbigEE, :pagIbigER,
        :withholdingTax, :loanDeductions, :otherDeductions,
        :absenceDeduction, :lateMinutes, :lateDeduction,
        :undertimeMinutes, :undertimeDeduction, :hdmfMp2,
        :sssLoanDeduction, :hdmfLoanDeduction, :cashAdvanceDeduction,
        :totalDeductions, :netPay, CURRENT_TIMESTAMP
      )`,
      args: record,
    });

    console.log(`Inserted: ${empNum} | ${periodStart.slice(0,10)}→${periodEnd.slice(0,10)} | gross:${record.grossPay} net:${record.netPay}`);
    existKeys.add(key); // prevent double-insert within same file
    inserted++;

  } catch (err) {
    console.error(`Row ${rowNum}: ERROR — ${err.message}`);
    errors++;
  }
}

console.log(`\nDone. Inserted: ${inserted} | Skipped: ${skipped} | Errors: ${errors}`);
