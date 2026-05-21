import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { php, phDate } from "@/lib/format";
import { Plus, Upload } from "lucide-react";

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "muted"> = {
  REGULAR: "success",
  PROBATIONARY: "warning",
  PROJECT: "muted",
  CASUAL: "muted",
  CONTRACTUAL: "muted",
};

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const employees = await prisma.employee.findMany({
    where: {
      archived: false,
      ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { employeeNumber: { contains: q } }] } : {}),
    },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} active · 201 files</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled title="CSV import — coming soon"><Upload className="h-4 w-4" />Import CSV</Button>
          <Link href="/employees/new"><Button size="sm"><Plus className="h-4 w-4" />Add employee</Button></Link>
        </div>
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={q ?? ""} placeholder="Search name or employee #..." />
      </form>

      {/* Mobile cards / desktop table */}
      <div className="grid gap-2 md:hidden">
        {employees.map((e) => (
          <Link key={e.id} href={`/employees/${e.id}`}>
            <Card><CardContent className="py-4">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-medium">{e.lastName}, {e.firstName}</div>
                  <div className="text-xs text-muted-foreground">{e.employeeNumber} · {e.position}</div>
                </div>
                <Badge variant={STATUS_BADGE[e.employmentStatus] ?? "muted"}>{e.employmentStatus}</Badge>
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{e.department}</span>
                <span>{php(e.basicMonthlyRate)}/mo</span>
              </div>
            </CardContent></Card>
          </Link>
        ))}
      </div>

      <div className="hidden md:block">
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Position / Dept.</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Hired</th>
                <th className="p-3 font-medium text-right">Monthly rate</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <Link href={`/employees/${e.id}`} className="font-medium hover:underline">{e.lastName}, {e.firstName}</Link>
                    <div className="text-xs text-muted-foreground">{e.employeeNumber}</div>
                  </td>
                  <td className="p-3">
                    <div>{e.position}</div>
                    <div className="text-xs text-muted-foreground">{e.department}</div>
                  </td>
                  <td className="p-3"><Badge variant={STATUS_BADGE[e.employmentStatus] ?? "muted"}>{e.employmentStatus}</Badge></td>
                  <td className="p-3 text-muted-foreground">{phDate(e.dateHired)}</td>
                  <td className="p-3 text-right font-medium">{php(e.basicMonthlyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      </div>
    </div>
  );
}
