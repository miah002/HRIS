import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OT_MULTIPLIERS } from "@/lib/ph-payroll";
import { Clock, MapPin } from "lucide-react";

// Mock: generate today's attendance overview using employees. Real impl wires up timeIn/timeOut Server Actions.
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Daily Time Record · {today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Clock in / out</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button>Time in</Button>
          <Button variant="outline">Time out</Button>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Geo-tagged (optional)</span>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Status</th>
              <th className="p-3">Time in</th>
              <th className="p-3">Time out</th>
              <th className="p-3 text-right">OT hrs (×{OT_MULTIPLIERS.regular})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, status, timeIn, timeOut, ot }) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{e.lastName}, {e.firstName}</td>
                <td className="p-3">
                  <Badge variant={status === "Present" ? "success" : status === "Late" ? "warning" : "muted"}>{status}</Badge>
                </td>
                <td className="p-3 text-muted-foreground">{timeIn}</td>
                <td className="p-3 text-muted-foreground">{timeOut}</td>
                <td className="p-3 text-right">{ot > 0 ? `${ot.toFixed(1)} h` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      <p className="text-xs text-muted-foreground">
        OT and night differential follow Labor Code Art. 86–87 (regular OT 125%, rest day OT 130%, ND +10% for 22:00–06:00).
        This view is read-only in the portfolio demo; full DTR + PDF export is implemented in <code>computeSemiMonthlyPayroll</code>.
      </p>
    </div>
  );
}
