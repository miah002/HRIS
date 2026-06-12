import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { php, phDate } from "@/lib/format";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { Gift } from "lucide-react";
import Link from "next/link";

async function generate13thMonth() {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  if (!companyId) redirect("/dashboard");

  const now = new Date();
  const year = now.getFullYear();
  const periodStart = new Date(year, 11, 1);
  const periodEnd = new Date(year, 11, 24);

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
  });

  // Build all upserts, then commit them in one batched transaction (not N round-trips).
  const writes = employees.map((e) => {
    const hiredDate = e.dateHired;
    const yearStart = new Date(year, 0, 1);
    const effectiveStart = hiredDate > yearStart ? hiredDate : yearStart;
    const monthsWorked = Math.min(
      12,
      Math.max(
        0,
        (now.getFullYear() - effectiveStart.getFullYear()) * 12 +
          (now.getMonth() - effectiveStart.getMonth()) +
          1
      )
    );
    const amount = (e.basicMonthlyRate * monthsWorked) / 12;

    return prisma.payroll.upsert({
      where: {
        employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart, periodEnd },
      },
      update: {
        basicPay: amount, grossPay: amount,
        sssEE: 0, philHealthEE: 0, pagIbigEE: 0, withholdingTax: 0,
        totalDeductions: 0, netPay: amount, status: "DRAFT",
      },
      create: {
        employeeId: e.id, periodStart, periodEnd,
        basicPay: amount, grossPay: amount,
        sssEE: 0, philHealthEE: 0, pagIbigEE: 0, withholdingTax: 0,
        totalDeductions: 0, netPay: amount, status: "DRAFT",
      },
    });
  });
  if (writes.length > 0) await prisma.$transaction(writes);

  redirect("/payroll/13th-month?generated=1");
}

export default async function ThirteenthMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ generated?: string }>;
}) {
  const { generated } = await searchParams;

  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const now = new Date();
  const year = now.getFullYear();
  const periodStart = new Date(year, 11, 1);
  const periodEnd = new Date(year, 11, 24);
  const dueDate = new Date(year, 11, 24);

  const [employees, existingPayrolls] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, archived: false },
      orderBy: { lastName: "asc" },
    }),
    prisma.payroll.findMany({
      where: { periodStart, periodEnd, employee: { companyId } },
    }),
  ]);

  const payrollMap = new Map(existingPayrolls.map((p) => [p.employeeId, p]));

  const rows = employees.map((e) => {
    const hiredDate = e.dateHired;
    const yearStart = new Date(year, 0, 1);
    const effectiveStart = hiredDate > yearStart ? hiredDate : yearStart;
    const monthsWorked = Math.min(
      12,
      Math.max(
        0,
        (now.getFullYear() - effectiveStart.getFullYear()) * 12 +
          (now.getMonth() - effectiveStart.getMonth()) +
          1
      )
    );
    const amount = (e.basicMonthlyRate * monthsWorked) / 12;
    const payroll = payrollMap.get(e.id) ?? null;
    return { employee: e, monthsWorked, amount, payroll };
  });

  const totalPayout = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-[var(--text-tertiary)]" />
            <h1 className="text-2xl font-semibold tracking-tight">13th Month Pay</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {year} · Due {phDate(dueDate)} · PD 851 (1/12 of total basic salary)
          </p>
        </div>
        <form action={generate13thMonth}>
          <Button type="submit">
            <Gift className="h-4 w-4" />
            Generate All
          </Button>
        </form>
      </div>

      {generated && (
        <div className="rounded-[var(--radius-md)] bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] px-4 py-3 text-sm">
          ✓ 13th month payroll generated for all active employees. Records are in DRAFT status.
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="text-2xs text-[var(--text-tertiary)] uppercase tracking-wide">Total payout</div>
          <div className="text-2xl font-semibold tabular mt-1">{php(totalPayout)}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">{employees.length} active employees · Tax-exempt up to ₱90,000 (TRAIN Law)</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th className="text-right">Monthly Rate</Th>
                <Th className="text-right">Months Worked</Th>
                <Th className="text-right">13th Month</Th>
                <Th>Status</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ employee: e, monthsWorked, amount, payroll }) => (
                <TableRow key={e.id}>
                  <Td>
                    <Link href={`/employees/${e.id}`} className="flex items-center gap-3 group/link">
                      <Avatar name={`${e.firstName} ${e.lastName}`} size="sm" />
                      <div>
                        <div className="text-sm font-medium group-hover/link:text-[var(--brand)] transition-colors">
                          {e.lastName}, {e.firstName}
                        </div>
                        <div className="text-2xs text-[var(--text-tertiary)]">{e.employeeNumber}</div>
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <span className="text-sm text-[var(--text-secondary)]">{e.department}</span>
                  </Td>
                  <Td numeric>{php(e.basicMonthlyRate)}</Td>
                  <Td numeric>{monthsWorked}</Td>
                  <Td numeric className="font-semibold">{php(amount)}</Td>
                  <Td>
                    {payroll ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={payroll.status === "RELEASED" ? "success" : "default"}>
                          {payroll.status}
                        </Badge>
                        <Link
                          href={`/payroll/${payroll.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
                        >
                          View Payslip
                        </Link>
                      </div>
                    ) : (
                      <Badge variant="neutral">Not generated</Badge>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-2xs text-[var(--text-tertiary)]">
        Formula: (Basic monthly rate × months worked) ÷ 12. Months worked capped at 12 and counted from January 1 or date hired (whichever is later).
        13th month pay is tax-exempt up to ₱90,000 under the TRAIN Law (RA 10963).
      </p>
    </div>
  );
}
