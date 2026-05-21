import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, STATUTORY_LEAVE } from "@/lib/ph-payroll";

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.employee.findUnique({
    where: { id },
    include: { payrolls: { orderBy: { periodStart: "desc" }, take: 5 }, leaves: { orderBy: { startDate: "desc" }, take: 5 }, documents: true },
  });
  if (!e) notFound();

  async function archive() {
    "use server";
    await prisma.employee.update({ where: { id }, data: { archived: true, archivedAt: new Date() } });
    redirect("/employees");
  }

  const projected = computeSemiMonthlyPayroll({
    monthlyRate: e.basicMonthlyRate,
    periodStart: new Date(),
    periodEnd: new Date(),
  });

  const yearsOfService = (Date.now() - +e.dateHired) / (1000 * 60 * 60 * 24 * 365.25);
  const eligibleSIL = yearsOfService >= 1;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Link href="/employees" className="text-sm text-muted-foreground hover:underline">← Back to employees</Link>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
          <div>
            <h1 className="text-2xl font-bold">{e.firstName} {e.middleName ?? ""} {e.lastName}</h1>
            <div className="text-sm text-muted-foreground">{e.employeeNumber} · {e.position} · {e.department}</div>
          </div>
          <div className="flex gap-2">
            <Badge variant="success">{e.employmentStatus}</Badge>
            <form action={archive}><Button variant="outline" size="sm" type="submit">Archive</Button></form>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">201 File</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <Info label="Email" value={e.email ?? "—"} />
            <Info label="Mobile" value={e.mobile ?? "—"} />
            <Info label="Date hired" value={phDate(e.dateHired)} />
            <Info label="Years of service" value={yearsOfService.toFixed(1)} />
            <Info label="Monthly rate" value={php(e.basicMonthlyRate)} />
            <Info label="TIN" value={e.tin ?? "—"} />
            <Info label="SSS" value={e.sssNumber ?? "—"} />
            <Info label="PhilHealth" value={e.philHealthNumber ?? "—"} />
            <Info label="Pag-IBIG" value={e.pagIbigNumber ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Projected semi-monthly payroll</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row label="Basic (½ month)" value={php(projected.basicPay)} />
            <Row label="SSS (EE)" value={`-${php(projected.sssEE)}`} />
            <Row label="PhilHealth (EE)" value={`-${php(projected.philHealthEE)}`} />
            <Row label="Pag-IBIG (EE)" value={`-${php(projected.pagIbigEE)}`} />
            <Row label="WHT (BIR)" value={`-${php(projected.withholdingTax)}`} />
            <hr className="my-1.5" />
            <Row label="Net pay" value={php(projected.netPay)} bold />
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Leave eligibility (PH statutory)</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {Object.entries(STATUTORY_LEAVE).map(([type, info]) => (
              <div key={type} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{type.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{info.ref}</div>
                </div>
                <Badge variant={type === "SIL" && !eligibleSIL ? "muted" : "outline"}>{info.days} days</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent payroll</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {e.payrolls.length === 0 && <p className="text-muted-foreground">No payroll runs yet.</p>}
            {e.payrolls.map((p) => (
              <div key={p.id} className="flex justify-between py-1.5 border-b last:border-0">
                <span>{phDate(p.periodStart)} – {phDate(p.periodEnd)}</span>
                <span className="font-medium">{php(p.netPay)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
