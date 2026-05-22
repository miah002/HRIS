import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const cutoffStart = now.getDate() <= 15
    ? new Date(year, month, 1)
    : new Date(year, month, 16);
  const cutoffEnd = now.getDate() <= 15
    ? new Date(year, month, 15)
    : new Date(year, month + 1, 0);

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
    include: {
      payrolls: {
        where: { periodStart: cutoffStart, periodEnd: cutoffEnd },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
  });

  const periodLabel = `${year}-${String(month + 1).padStart(2, "0")}`;
  const headers = ["SS No.", "Surname", "First Name", "Middle Name", "Monthly Salary", "SS EE", "SS ER", "EC ER"];

  const rows = employees.map((e) => {
    const p = e.payrolls[0];
    const sssEE = p ? p.sssEE * 2 : 0;
    const sssER = p ? p.sssER * 2 : 0;
    return [
      e.sssNumber ?? "",
      e.lastName,
      e.firstName,
      e.middleName ?? "",
      e.basicMonthlyRate.toFixed(2),
      sssEE.toFixed(2),
      sssER.toFixed(2),
      "10.00",
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="SSS-R3-${periodLabel}.csv"`,
    },
  });
}
