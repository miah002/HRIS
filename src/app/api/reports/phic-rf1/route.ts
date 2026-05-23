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
  const headers = ["PhilHealth No.", "Surname", "First Name", "Monthly Basic Salary", "EE Premium", "ER Premium"];

  const rows = employees.map((e) => {
    const eePremium = e.payrolls.reduce((s, p) => s + p.philHealthEE, 0);
    const erPremium = e.payrolls.reduce((s, p) => s + p.philHealthER, 0);
    return [
      e.philHealthNumber ?? "",
      e.lastName,
      e.firstName,
      e.basicMonthlyRate.toFixed(2),
      eePremium.toFixed(2),
      erPremium.toFixed(2),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="PhilHealth-RF1-${periodLabel}.csv"`,
    },
  });
}
