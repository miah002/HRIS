# Payroll Import Template

## How to use

1. Create an Excel file (.xlsx) with **row 1 as column headers** (exact names below)
2. One row per employee per cutoff period
3. Run:

```bash
TURSO_DATABASE_URL=libsql://mmtsi-miah002.aws-ap-northeast-1.turso.io \
TURSO_AUTH_TOKEN=<token> \
node scripts/import-payroll.mjs your-file.xlsx --dry-run
```

Remove `--dry-run` to actually insert.

---

## Column headers (exact spelling, case-sensitive)

| Column | Required | Example | Notes |
|--------|----------|---------|-------|
| `employeeNumber` | ✅ | MMTSI2019-002 | Must match exactly |
| `periodStart` | ✅ | 2026-01-11 | YYYY-MM-DD |
| `periodEnd` | ✅ | 2026-01-25 | YYYY-MM-DD |
| `basicPay` | ✅ | 10000 | Half-month basic |
| `grossPay` | ✅ | 10431.03 | |
| `totalDeductions` | ✅ | 1362.50 | |
| `netPay` | ✅ | 9068.53 | |
| `sssEE` | | 450 | |
| `sssER` | | 472.50 | |
| `philHealthEE` | | 250 | |
| `philHealthER` | | 250 | |
| `pagIbigEE` | | 100 | |
| `pagIbigER` | | 100 | |
| `withholdingTax` | | 562.50 | |
| `overtimePay` | | 431.03 | |
| `nightDiffPay` | | 0 | |
| `holidayPay` | | 0 | |
| `allowances` | | 0 | |
| `loanDeductions` | | 0 | |
| `absenceDeduction` | | 0 | |
| `lateDeduction` | | 0 | |
| `undertimeDeduction` | | 0 | |
| `sssLoanDeduction` | | 0 | |
| `hdmfLoanDeduction` | | 0 | |
| `cashAdvanceDeduction` | | 0 | |
| `daysWorked` | | 11 | |
| `nonTaxableAdjustments` | | 0 | De minimis |
| `taxableAdjustments` | | 0 | |
| `hdmfMp2` | | 0 | Voluntary savings |

---

## Standard MMTSI cutoffs

| Cutoff | Period | Pay date |
|--------|--------|----------|
| 1st | 11th – 25th | 30th |
| 2nd | 26th – 10th (next month) | 15th |

## Example rows

| employeeNumber | periodStart | periodEnd | basicPay | grossPay | totalDeductions | netPay | sssEE | philHealthEE | pagIbigEE | withholdingTax |
|---|---|---|---|---|---|---|---|---|---|---|
| MMTSI2019-002 | 2026-01-11 | 2026-01-25 | 19000 | 19000 | 2362.50 | 16637.50 | 787.50 | 475 | 100 | 1000 |
| MMTSI2019-003 | 2026-01-11 | 2026-01-25 | 16000 | 16000 | 1874.53 | 14125.47 | 720 | 400 | 100 | 654.53 |
