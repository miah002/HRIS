import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isFirstCutoff } from "@/lib/cutoff";

// GET /api/payroll/register?start=ISO&end=ISO
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const startParam = searchParams.get("start");
  const endParam   = searchParams.get("end");
  if (!startParam || !endParam) {
    return new NextResponse("Missing start or end", { status: 400 });
  }

  const start = new Date(startParam);
  const end   = new Date(endParam);

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  if (!companyId) return new NextResponse("No company", { status: 403 });

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  const payrolls = await prisma.payroll.findMany({
    where: { periodStart: start, periodEnd: end, employee: { companyId } },
    include: { employee: { select: { firstName: true, middleName: true, lastName: true } } },
    orderBy: { employee: { lastName: "asc" } },
  });

  // Date formatter (PH locale)
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

  // Paydate: 11-25 → 30th same month; 26-10 → 15th end month
  const paydate = isFirstCutoff(start)
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 30))
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 15));

  const COL_COUNT = 20;

  const thin: ExcelJS.BorderStyle = "thin";
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: thin }, bottom: { style: thin },
    left: { style: thin }, right: { style: thin },
  };

  function borderRow(row: ExcelJS.Row) {
    for (let c = 1; c <= COL_COUNT; c++) row.getCell(c).border = thinBorder;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Payroll Register");

  // Column widths
  ws.getColumn(1).width = 30;
  for (let i = 2; i <= COL_COUNT; i++) ws.getColumn(i).width = 16;

  // ── Header block (no borders) ──
  ws.addRow([company?.name ?? "Company"]).getCell(1).font = { bold: true };
  ws.addRow([company?.address ?? ""]);
  ws.addRow(["Payroll Register"]);
  ws.addRow(["Semi-Monthly"]);
  ws.addRow([`Payroll Period ${fmt(paydate)}`]);
  ws.addRow([]);
  ws.addRow([]);

  // ── Column headers row ──
  const headers = [
    "Name", "Taxable Income", "Basic Pay", "Absences", "Tardiness/Undertime",
    "Overtime Pay", "De Minimis", "NT Adjustments", "Taxable Adjustments",
    "Total Earnings", "Withholding tax", "SSS EE", "PH EE", "HDMF EE",
    "SSS Loan", "HDMF Loan", "Advances to OE", "HDMF MP2", "Total Deductions", "Net Pay",
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // ── "Compensation:" section label ──
  const compRow = ws.addRow(["Compensation:"]);
  compRow.getCell(1).font = { italic: true };
  borderRow(compRow);

  // ── Employee data rows ──
  const totals = new Array<number>(COL_COUNT - 1).fill(0);

  for (const p of payrolls) {
    const emp = p.employee;
    const mi = emp.middleName ? emp.middleName.charAt(0).toUpperCase() + "." : null;
    const name = [emp.firstName, mi, emp.lastName].filter(Boolean).join(" ");

    const taxableIncome = round2(
      p.grossPay - p.nonTaxableAdjustments - (p.sssEE + p.philHealthEE + p.pagIbigEE)
    );

    const values = [
      round2(taxableIncome),
      round2(p.basicPay),
      round2(p.absenceDeduction),
      round2(p.lateDeduction + p.undertimeDeduction),
      round2(p.overtimePay),
      round2(p.nonTaxableAdjustments),
      round2(p.nonTaxableAdjustments),
      round2(p.taxableAdjustments),
      round2(p.grossPay),
      round2(p.withholdingTax),
      round2(p.sssEE),
      round2(p.philHealthEE),
      round2(p.pagIbigEE),
      round2(p.sssLoanDeduction),
      round2(p.hdmfLoanDeduction),
      round2(p.cashAdvanceDeduction),
      round2(p.hdmfMp2),
      round2(p.totalDeductions),
      round2(p.netPay),
    ];
    for (let i = 0; i < totals.length; i++) totals[i] = round2(totals[i] + values[i]);

    const dataRow = ws.addRow([name, ...values]);
    borderRow(dataRow);
    // Right-align numeric cells
    for (let c = 2; c <= COL_COUNT; c++) {
      dataRow.getCell(c).alignment = { horizontal: "right" };
    }
  }

  // ── Grand Total row ──
  const totalRow = ws.addRow(["Grand Total", ...totals]);
  totalRow.font = { bold: true };
  borderRow(totalRow);
  for (let c = 2; c <= COL_COUNT; c++) {
    totalRow.getCell(c).alignment = { horizontal: "right" };
  }

  const buf = await wb.xlsx.writeBuffer();
  const filename = `Payroll-Register-${start.toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
