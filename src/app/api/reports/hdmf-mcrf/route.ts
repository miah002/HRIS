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
  const monthParam = url.searchParams.get("month");
  let year: number, month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    year = parseInt(monthParam.slice(0, 4));
    month = parseInt(monthParam.slice(5, 7)) - 1;
  } else {
    const ph = nowPH();
    year = ph.getFullYear();
    month = ph.getMonth();
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
  const headers = ["HDMF No.", "Surname", "First Name", "Monthly Compensation", "EE Contribution", "ER Contribution"];

  const rows = employees.map((e) => {
    const eeContrib = e.payrolls.reduce((s, p) => s + p.pagIbigEE, 0);
    const erContrib = e.payrolls.reduce((s, p) => s + p.pagIbigER, 0);
    return [
      e.pagIbigNumber ?? "",
      e.lastName,
      e.firstName,
      e.basicMonthlyRate.toFixed(2),
      eeContrib.toFixed(2),
      erContrib.toFixed(2),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="PagIBIG-MCRF-${periodLabel}.csv"`,
    },
  });
}
