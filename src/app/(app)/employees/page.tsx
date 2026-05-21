import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import { php, phDate } from "@/lib/format";
import { Plus, Upload, Search, Users } from "lucide-react";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const employees = await prisma.employee.findMany({
    where: {
      archived: false,
      ...(q ? { OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { employeeNumber: { contains: q } },
        { department: { contains: q } },
      ]} : {}),
    },
    orderBy: { lastName: "asc" },
  });

  const deptCounts = employees.reduce<Record<string, number>>(
    (acc, e) => ({ ...acc, [e.department]: (acc[e.department] ?? 0) + 1 }), {}
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--text-tertiary)]" />
            <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {employees.length} active · {Object.keys(deptCounts).length} departments
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" disabled title="CSV import — coming soon">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Link href="/employees/new">
            <Button size="sm"><Plus className="h-3.5 w-3.5" />Add employee</Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <form className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        <Input name="q" defaultValue={q ?? ""} placeholder="Search name, dept…" className="pl-9" />
      </form>

      {/* Mobile card list */}
      <div className="grid gap-2 md:hidden">
        {employees.length === 0 && <EmptyState q={q} />}
        {employees.map((e) => (
          <Link key={e.id} href={`/employees/${e.id}`}>
            <Card interactive>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={`${e.firstName} ${e.lastName}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.lastName}, {e.firstName}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{e.employeeNumber} · {e.position}</div>
                  </div>
                  <Badge variant={STATUS_BADGE[e.employmentStatus]}>{e.employmentStatus}</Badge>
                </div>
                <div className="mt-3 flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>{e.department}</span>
                  <span className="tabular font-medium">{php(e.basicMonthlyRate)}/mo</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            {employees.length === 0 ? (
              <EmptyState q={q} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <Th>Employee</Th>
                    <Th>Position</Th>
                    <Th>Department</Th>
                    <Th>Status</Th>
                    <Th>Hired</Th>
                    <Th className="text-right">Monthly rate</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <Td>
                        <Link
                          href={`/employees/${e.id}`}
                          className="flex items-center gap-3 group/link"
                        >
                          <Avatar name={`${e.firstName} ${e.lastName}`} size="sm" />
                          <div>
                            <div className="text-sm font-medium group-hover/link:text-[var(--brand)] transition-colors">
                              {e.lastName}, {e.firstName}
                            </div>
                            <div className="text-2xs text-[var(--text-tertiary)]">{e.employeeNumber}</div>
                          </div>
                        </Link>
                      </Td>
                      <Td className="text-[var(--text-secondary)]">{e.position}</Td>
                      <Td>
                        <Badge variant="neutral">{e.department}</Badge>
                      </Td>
                      <Td>
                        <Badge variant={STATUS_BADGE[e.employmentStatus]}>{e.employmentStatus}</Badge>
                      </Td>
                      <Td className="text-[var(--text-secondary)]">{phDate(e.dateHired)}</Td>
                      <Td numeric className="font-medium">{php(e.basicMonthlyRate)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ q }: { q?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-12 w-12 rounded-[var(--radius-md)] bg-[var(--brand-subtle)] grid place-items-center mb-4">
        <Users className="h-6 w-6 text-[var(--brand)]" />
      </div>
      <p className="font-medium text-sm">
        {q ? `No employees match "${q}"` : "Your team starts here"}
      </p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
        {q ? "Try a different name or department." : "Add your first employee or import from a spreadsheet."}
      </p>
      {!q && (
        <Link href="/employees/new" className="mt-4">
          <Button size="sm"><Plus className="h-3.5 w-3.5" />Add first employee</Button>
        </Link>
      )}
    </div>
  );
}
