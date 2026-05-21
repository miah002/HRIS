import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll } from "@/lib/ph-payroll";

// Determine current cutoff window (1–15 or 16–end of month) — standard PH semi-monthly cadence.
function currentCutoff(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  if (day <= 15) return { start: new Date(year, month, 1), end: new Date(year, month, 15), label: "1–15" };
  return { start: new Date(year, month, 16), end: new Date(year, month + 1, 0), label: "16–end" };
}

async function runPayroll(formData: FormData) {
  "use server";
  const start = new Date(String(formData.get("start")));
  const end = new Date(String(formData.get("end")));
  const employees = await prisma.employee.findMany({ where: { archived: false } });

  for (const e of employees) {
    const calc = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: start, periodEnd: end });
    await prisma.payroll.upsert({
      where: { employeeId_periodStart_periodEnd: { employeeId: e.id, periodStart: start, periodEnd: end } },
      update: { ...calc, status: "DRAFT" },
      create: { employeeId: e.id, periodStart: start, periodEnd: end, status: "DRAFT", ...calc },
    });
  }
  redirect(`/payroll?ran=1`);
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ ran?: string }> }) {
  const { ran } = await searchParams;
  const cutoff = currentCutoff();
  const runs = await prisma.payroll.findMany({
    where: { periodStart: cutoff.start, periodEnd: cutoff.end },
    include: { employee: true },
    orderBy: { employee: { lastName: "asc" } },
  });
  const totals = runs.reduce(
    (acc, p) => ({
      gross: acc.gross + p.grossPay,
      net: acc.net + p.netPay,
      sssEE: acc.sssEE + p.sssEE,
      sssER: acc.sssER + p.sssER,
      phicEE: acc.phicEE + p.philHealthEE,
      phicER: acc.phicER + p.philHealthER,
      hdmfEE: acc.hdmfEE + p.pagIbigEE,
      hdmfER: acc.hdmfER + p.pagIbigER,
      wht: acc.wht + p.withholdingTax,
    }),
    { gross: 0, net: 0, sssEE: 0, sssER: 0, phicEE: 0, phicER: 0, hdmfEE: 0, hdmfER: 0, wht: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Cutoff {cutoff.label} · {phDate(cutoff.start)} – {phDate(cutoff.end)}</p>
        </div>
        <form action={runPayroll}>
          <input type="hidden" name="start" value={cutoff.start.toISOString()} />
          <input type="hidden" name="end" value={cutoff.end.toISOString()} />
          <Button type="submit">{runs.length ? "Re-run payroll" : "Run payroll"}</Button>
        </form>
      </div>

      {ran && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 text-sm">Payroll computed for all active employees. Review and release below.</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini label="Gross pay" value={php(totals.gross)} />
        <Mini label="Net pay" value={php(totals.net)} />
        <Mini label="WHT (BIR 1601-C)" value={php(totals.wht)} />
        <Mini label="Statutory (EE+ER)" value={php(totals.sssEE + totals.sssER + totals.phicEE + totals.phicER + totals.hdmfEE + totals.hdmfER)} />
      </div>

      {runs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No payroll computed for this cutoff yet. Click <strong>Run payroll</strong> to compute.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3 text-right">Gross</th>
                  <th className="p-3 text-right">SSS</th>
                  <th className="p-3 text-right">PHIC</th>
                  <th className="p-3 text-right">HDMF</th>
                  <th className="p-3 text-right">WHT</th>
                  <th className="p-3 text-right">Net pay</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <Link href={`/employees/${p.employeeId}`} className="font-medium hover:underline">{p.employee.lastName}, {p.employee.firstName}</Link>
                      <div className="text-xs text-muted-foreground">{p.employee.employeeNumber}</div>
                    </td>
                    <td className="p-3 text-right">{php(p.grossPay)}</td>
                    <td className="p-3 text-right">{php(p.sssEE)}</td>
                    <td className="p-3 text-right">{php(p.philHealthEE)}</td>
                    <td className="p-3 text-right">{php(p.pagIbigEE)}</td>
                    <td className="p-3 text-right">{php(p.withholdingTax)}</td>
                    <td className="p-3 text-right font-semibold">{php(p.netPay)}</td>
                    <td className="p-3 text-right"><Badge variant={p.status === "RELEASED" ? "success" : "muted"}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td className="p-3">Totals</td>
                  <td className="p-3 text-right">{php(totals.gross)}</td>
                  <td className="p-3 text-right">{php(totals.sssEE)}</td>
                  <td className="p-3 text-right">{php(totals.phicEE)}</td>
                  <td className="p-3 text-right">{php(totals.hdmfEE)}</td>
                  <td className="p-3 text-right">{php(totals.wht)}</td>
                  <td className="p-3 text-right">{php(totals.net)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Employer counterpart contributions (this cutoff)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3 text-sm">
          <Mini label="SSS (employer)" value={php(totals.sssER)} />
          <Mini label="PhilHealth (employer)" value={php(totals.phicER)} />
          <Mini label="Pag-IBIG (employer)" value={php(totals.hdmfER)} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Computations use TRAIN Law BIR tables (RR 11-2018), SSS 2025 schedule (RA 11199), PhilHealth 5% premium (RA 11223), and HDMF 2%/2% (Circular 460). See <code>src/lib/ph-payroll.ts</code>.
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </CardContent></Card>
  );
}
