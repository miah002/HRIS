import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  let year: number, month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    year = parseInt(monthParam.slice(0, 4));
    month = parseInt(monthParam.slice(5, 7)) - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
    include: {
      payrolls: {
        where: { periodStart: { gte: monthStart }, periodEnd: { lte: monthEnd } },
      },
    },
    orderBy: { lastName: "asc" },
  });

  const periodLabel = `${year}-${String(month + 1).padStart(2, "0")}`;
  const headers = ["TIN", "Surname", "First Name", "Gross Compensation", "Taxable Compensation", "Tax Withheld (Monthly)"];

  const rows = employees.map((e) => {
    const grossMonthly = e.payrolls.reduce((s, p) => s + p.grossPay, 0);
    const taxable = e.payrolls.reduce((s, p) => s + (p.grossPay - p.sssEE - p.philHealthEE - p.pagIbigEE), 0);
    const taxMonthly = e.payrolls.reduce((s, p) => s + p.withholdingTax, 0);
    return [
      e.tin ?? "",
      e.lastName,
      e.firstName,
      grossMonthly.toFixed(2),
      taxable.toFixed(2),
      taxMonthly.toFixed(2),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="BIR-1601C-${periodLabel}.csv"`,
    },
  });
}
