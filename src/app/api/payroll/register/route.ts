import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
    where: {
      periodStart: start,
      periodEnd:   end,
      employee: { companyId },
    },
    include: {
      employee: { select: { firstName: true, middleName: true, lastName: true } },
    },
    orderBy: { employee: { lastName: "asc" } },
  });

  // Format date: "May 31, 2026"
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

  // Build worksheet as array-of-arrays
  const aoa: (string | number | null)[][] = [];

  // Header block — matches MMTSI Payroll Register template
  aoa.push([company?.name ?? "Company"]);
  aoa.push([company?.address ?? ""]);
  aoa.push(["Payroll Register"]);
  aoa.push(["Semi-Monthly"]);
  aoa.push([`Payroll Period ${fmt(start)} – ${fmt(end)}`]);
  aoa.push([]); // blank row
  aoa.push([]); // blank row

  // Column headers
  const headers = [
    "Name",
    "Taxable Income",
    "Basic Pay",
    "Absences",
    "Tardiness/Undertime",
    "Overtime Pay",
    "De Minimis",
    "NT Adjustments",
    "Taxable Adjustments",
    "Total Earnings",
    "Withholding tax",
    "SSS EE",
    "PH EE",
    "HDMF EE",
    "SSS Loan",
    "HDMF Loan",
    "Advances to OE",
    "HDMF MP2",
    "Total Deductions",
    "Net Pay",
  ];
  aoa.push(headers);

  // "Compensation:" section label row
  aoa.push(["Compensation:"]);

  // Grand total accumulators
  const totals = new Array<number>(headers.length - 1).fill(0);

  for (const p of payrolls) {
    const emp = p.employee;
    // Name format: First MI. Last  (e.g. "Angela Luz C. Veloso")
    const mi = emp.middleName ? emp.middleName.charAt(0).toUpperCase() + "." : null;
    const name = [emp.firstName, mi, emp.lastName].filter(Boolean).join(" ");

    const taxableIncome =
      p.grossPay - p.nonTaxableAdjustments - (p.sssEE + p.philHealthEE + p.pagIbigEE);

    const row: (string | number)[] = [
      name,
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

    // Accumulate totals (skip first col which is name)
    for (let i = 0; i < totals.length; i++) {
      totals[i] = round2(totals[i] + (row[i + 1] as number));
    }

    aoa.push(row);
  }

  // Grand total row
  aoa.push(["Grand Total", ...totals]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws["!cols"] = [
    { wch: 30 }, // Name
    ...Array(headers.length - 1).fill({ wch: 16 }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payroll Register");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `Payroll-Register-${start.toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
