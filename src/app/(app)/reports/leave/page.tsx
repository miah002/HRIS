import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, CalendarCheck } from "lucide-react";
import { YearNav } from "../2316/year-nav";
import { CsvExport } from "../13th-month/csv-export";

const LEAVE_TYPES: Record<string, { label: string; entitled: number }> = {
  VL:        { label: "Vacation",  entitled: 15 },
  SL:        { label: "Sick",      entitled: 15 },
  MATERNITY: { label: "Maternity", entitled: 105 },
  PATERNITY: { label: "Paternity", entitled: 7  },
};

const LEAVE_KEYS = ["VL", "SL"] as const;

export default async function LeaveReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()));
  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

  const employees = await prisma.employee.findMany({
    where: { companyId, archived: false },
    include: {
      leaves: {
        where: {
          status: "APPROVED",
          startDate: { gte: yearStart },
          endDate:   { lte: yearEnd },
        },
      },
      payrolls: {
        where: { periodStart: { gte: yearStart }, periodEnd: { lte: yearEnd } },
        select: { holidayPay: true },
      },
    },
    orderBy: [{ department: "asc" }, { lastName: "asc" }],
  });

  const rows = employees.map((e) => {
    const used: Record<string, number> = {};
    for (const l of e.leaves) {
      used[l.leaveType] = (used[l.leaveType] ?? 0) + l.days;
    }
    const totalHolidayPay = e.payrolls.reduce((s, p) => s + p.holidayPay, 0);
    const totalLeaveUsed = e.leaves.reduce((s, l) => s + l.days, 0);
    return { employee: e, used, totalHolidayPay, totalLeaveUsed };
  });

  // also fetch all approved leaves for the year for the requests table
  const allLeaves = await prisma.leaveRequest.findMany({
    where: {
      employee: { companyId },
      status: "APPROVED",
      startDate: { gte: yearStart },
      endDate:   { lte: yearEnd },
    },
    include: { employee: { select: { firstName: true, lastName: true, department: true } } },
    orderBy: { startDate: "asc" },
  });

  const csvRows = rows.map((r) => [
    r.employee.employeeNumber,
    `${r.employee.lastName}, ${r.employee.firstName}`,
    r.employee.department,
    String(r.used["VL"] ?? 0),
    String(LEAVE_TYPES.VL.entitled - (r.used["VL"] ?? 0)),
    String(r.used["SL"] ?? 0),
    String(LEAVE_TYPES.SL.entitled - (r.used["SL"] ?? 0)),
    String(r.totalLeaveUsed),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Reports
        </Link>
        <CsvExport
          filename={`LeaveReport-${year}.csv`}
          headers={["Emp No.", "Name", "Department", "VL Used", "VL Balance", "SL Used", "SL Balance", "Total Used"]}
          rows={rows.map((r) => [
            r.employee.employeeNumber,
            `${r.employee.lastName}, ${r.employee.firstName}`,
            r.employee.department,
            String(r.used["VL"] ?? 0),
            String(Math.max(0, LEAVE_TYPES.VL.entitled - (r.used["VL"] ?? 0))),
            String(r.used["SL"] ?? 0),
            String(Math.max(0, LEAVE_TYPES.SL.entitled - (r.used["SL"] ?? 0))),
            String(r.totalLeaveUsed),
          ])}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold">Leave Summary</h1>
        <p className="text-sm text-[var(--text-secondary)]">Approved leave usage per employee · {year}</p>
      </div>

      <YearNav year={year} />

      {/* Balances table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-[var(--brand)]" />
            Leave Balances — {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Dept</Th>
                <Th className="text-center" colSpan={2}>VL (15 days)</Th>
                <Th className="text-center" colSpan={2}>SL (15 days)</Th>
                <Th numeric>Holiday Pay</Th>
              </TableRow>
              <TableRow>
                <Th />
                <Th />
                <Th className="text-center text-[10px]">Used</Th>
                <Th className="text-center text-[10px]">Left</Th>
                <Th className="text-center text-[10px]">Used</Th>
                <Th className="text-center text-[10px]">Left</Th>
                <Th />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ employee: e, used, totalHolidayPay }) => {
                const vlUsed = used["VL"] ?? 0;
                const slUsed = used["SL"] ?? 0;
                const vlLeft = Math.max(0, 15 - vlUsed);
                const slLeft = Math.max(0, 15 - slUsed);
                return (
                  <TableRow key={e.id}>
                    <Td>
                      <div className="font-medium text-xs">{e.lastName}, {e.firstName}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">{e.employeeNumber}</div>
                    </Td>
                    <Td className="text-xs">{e.department}</Td>
                    <Td className="text-center text-xs">{vlUsed || "—"}</Td>
                    <Td className="text-center text-xs">
                      <span className={vlLeft <= 3 ? "text-amber-600 font-medium" : ""}>{vlLeft}</span>
                    </Td>
                    <Td className="text-center text-xs">{slUsed || "—"}</Td>
                    <Td className="text-center text-xs">
                      <span className={slLeft <= 3 ? "text-amber-600 font-medium" : ""}>{slLeft}</span>
                    </Td>
                    <Td numeric className="text-xs">
                      {totalHolidayPay > 0 ? `₱${totalHolidayPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Leave requests log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Approved Leave Requests — {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Dept</Th>
                <Th>Type</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th className="text-center">Days</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLeaves.length === 0 ? (
                <TableRow>
                  <Td colSpan={6} className="text-center text-xs text-[var(--text-tertiary)] py-8">
                    No approved leave requests for {year}
                  </Td>
                </TableRow>
              ) : allLeaves.map((l) => (
                <TableRow key={l.id}>
                  <Td className="text-xs font-medium">{l.employee.lastName}, {l.employee.firstName}</Td>
                  <Td className="text-xs">{l.employee.department}</Td>
                  <Td>
                    <Badge variant="outline" className="text-[10px]">
                      {LEAVE_TYPES[l.leaveType]?.label ?? l.leaveType}
                    </Badge>
                  </Td>
                  <Td className="text-xs">{l.startDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</Td>
                  <Td className="text-xs">{l.endDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</Td>
                  <Td className="text-center text-xs font-semibold">{l.days}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--text-tertiary)]">
        Balances reset January 1. Holiday pay sourced from payroll records for the year.
      </p>
    </div>
  );
}
