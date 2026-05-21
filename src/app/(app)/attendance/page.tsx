import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { OT_MULTIPLIERS } from "@/lib/ph-payroll";
import { Clock, MapPin, LogIn, LogOut } from "lucide-react";

// Mock attendance overview. Real impl wires timeIn/timeOut Server Actions.
export default async function AttendancePage() {
  const employees = await prisma.employee.findMany({ where: { archived: false }, take: 10 });
  const today = new Date();
  const rows = employees.map((e, i) => {
    const status = i % 7 === 0 ? "Absent" : i % 5 === 0 ? "Late" : "Present";
    const timeIn = i % 7 === 0 ? "—" : i % 5 === 0 ? "08:32 AM" : "07:55 AM";
    const timeOut = i % 7 === 0 ? "—" : i % 4 === 0 ? "07:12 PM" : "05:03 PM";
    const ot = i % 4 === 0 && i % 7 !== 0 ? 1.5 : 0;
    return { e, status, timeIn, timeOut, ot };
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[var(--text-tertiary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Daily Time Record · {today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Clock in / out</CardTitle></CardHeader>
        <CardContent className="pt-3 flex flex-wrap items-center gap-3">
          <Button size="sm"><LogIn className="h-3.5 w-3.5" />Time in</Button>
          <Button size="sm" variant="secondary"><LogOut className="h-3.5 w-3.5" />Time out</Button>
          <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
            <MapPin className="h-3 w-3" />Geo-tagged (optional)
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Employee</Th>
                <Th>Status</Th>
                <Th>Time in</Th>
                <Th>Time out</Th>
                <Th className="text-right">OT (×{OT_MULTIPLIERS.regular})</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ e, status, timeIn, timeOut, ot }) => (
                <TableRow key={e.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={`${e.firstName} ${e.lastName}`} size="sm" />
                      <span className="text-sm font-medium">{e.lastName}, {e.firstName}</span>
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={status === "Present" ? "success" : status === "Late" ? "warning" : "neutral"} dot>
                      {status}
                    </Badge>
                  </Td>
                  <Td className="text-[var(--text-secondary)] tabular">{timeIn}</Td>
                  <Td className="text-[var(--text-secondary)] tabular">{timeOut}</Td>
                  <Td numeric>{ot > 0 ? `${ot.toFixed(1)} h` : "—"}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-2xs text-[var(--text-tertiary)]">
        OT and night differential follow Labor Code Art. 86–87 (regular OT 125%, rest day OT 130%, ND +10% for 22:00–06:00).
        Read-only in the portfolio demo; computation lives in <code>computeSemiMonthlyPayroll</code>.
      </p>
    </div>
  );
}
