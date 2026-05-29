import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nowPH } from "@/lib/format";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const url = new URL(req.url);
  const ph = nowPH();
  const year = parseInt(url.searchParams.get("year") ?? String(ph.getFullYear()));
  const month = parseInt(url.searchParams.get("month") ?? String(ph.getMonth() + 1));
  const half = parseInt(url.searchParams.get("half") ?? (ph.getDate() <= 15 ? "1" : "2"));

  const periodStart = half === 1
    ? new Date(year, month - 1, 1)
    : new Date(year, month - 1, 16);
  const periodEnd = half === 1
    ? new Date(year, month - 1, 15)
    : new Date(year, month, 0);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const periodLabel = `${MONTHS[month - 1]} ${year} (${half === 1 ? "1–15" : "16–end"})`;
  const fileLabel = `${year}-${String(month).padStart(2, "0")}-${half === 1 ? "1" : "2"}`;

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
    include: {
      payrolls: {
        where: { periodStart, periodEnd },
        take: 1,
      },
    },
    orderBy: [{ department: "asc" }, { lastName: "asc" }],
  });

  const headers = [
    "Emp No.", "Name", "Department", "Position", "Days Worked",
    "Basic Pay", "OT Pay", "Night Diff", "Holiday Pay", "Gross Pay",
    "SSS EE", "PhilHealth EE", "Pag-IBIG EE", "Withholding Tax",
    "Loan Deductions", "Total Deductions", "Net Pay",
  ];

  const rows = employees.map((e) => {
    const p = e.payrolls[0];
    if (!p) {
      return [e.employeeNumber, `${e.lastName}, ${e.firstName}`, e.department, e.position,
        "0","0.00","0.00","0.00","0.00","0.00","0.00","0.00","0.00","0.00","0.00","0.00","0.00"];
    }
    const totalDed = p.sssEE + p.philHealthEE + p.pagIbigEE + p.withholdingTax + p.loanDeductions;
    return [
      e.employeeNumber,
      `${e.lastName}, ${e.firstName}`,
      e.department,
      e.position,
      p.daysWorked.toFixed(1),
      p.basicPay.toFixed(2),
      p.overtimePay.toFixed(2),
      p.nightDiffPay.toFixed(2),
      p.holidayPay.toFixed(2),
      p.grossPay.toFixed(2),
      p.sssEE.toFixed(2),
      p.philHealthEE.toFixed(2),
      p.pagIbigEE.toFixed(2),
      p.withholdingTax.toFixed(2),
      p.loanDeductions.toFixed(2),
      totalDed.toFixed(2),
      p.netPay.toFixed(2),
    ];
  });

  // Totals row
  const withPayroll = employees.filter(e => e.payrolls[0]);
  const totals = [
    "", "TOTAL", "", "", "",
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.basicPay ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.overtimePay ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.nightDiffPay ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.holidayPay ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.grossPay ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.sssEE ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.philHealthEE ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.pagIbigEE ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.withholdingTax ?? 0), 0).toFixed(2),
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.loanDeductions ?? 0), 0).toFixed(2),
    "",
    withPayroll.reduce((s, e) => s + (e.payrolls[0]?.netPay ?? 0), 0).toFixed(2),
  ];

  const csv = [
    [`"Pay Register — ${periodLabel}"`],
    headers,
    ...rows,
    totals,
  ]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="PayRegister-${fileLabel}.csv"`,
    },
  });
}
