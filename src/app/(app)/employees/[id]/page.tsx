import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_BADGE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { php, phDate } from "@/lib/format";
import { computeSemiMonthlyPayroll, STATUTORY_LEAVE } from "@/lib/ph-payroll";
import { ChevronLeft, Mail, Phone, Building2 } from "lucide-react";

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.employee.findUnique({
    where: { id },
    include: {
      payrolls: { orderBy: { periodStart: "desc" }, take: 6 },
      leaves: { orderBy: { startDate: "desc" }, take: 5 },
    },
  });
  if (!e) notFound();

  async function archive() {
    "use server";
    await prisma.employee.update({ where: { id }, data: { archived: true, archivedAt: new Date() } });
    redirect("/employees");
  }

  const projected = computeSemiMonthlyPayroll({ monthlyRate: e.basicMonthlyRate, periodStart: new Date(), periodEnd: new Date() });
  const yearsOfService = (Date.now() - +e.dateHired) / (1000 * 60 * 60 * 24 * 365.25);
  const eligibleSIL = yearsOfService >= 1;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back link */}
      <Link href="/employees" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
        <ChevronLeft className="h-3 w-3" /> Back to employees
      </Link>

      {/* Profile header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${e.firstName} ${e.lastName}`} size="xl" />
          <div>
            <h1 className="text-xl font-semibold">{e.firstName} {e.middleName ?? ""} {e.lastName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-[var(--text-secondary)]">{e.position}</span>
              <span className="text-[var(--border-strong)]">·</span>
              <Badge variant="neutral">{e.department}</Badge>
              <Badge variant={STATUS_BADGE[e.employmentStatus]}>{e.employmentStatus}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
              {e.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{e.email}</span>}
              {e.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.mobile}</span>}
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{e.employeeNumber}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <form action={archive}>
            <Button type="submit" variant="danger" size="sm">Archive</Button>
          </form>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* 201 Info */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>201 File</CardTitle></CardHeader>
          <CardContent className="pt-3 grid sm:grid-cols-2 gap-y-4 gap-x-8">
            <Info label="Date hired" value={phDate(e.dateHired)} />
            <Info label="Years of service" value={`${yearsOfService.toFixed(1)} years`} />
            <Info label="Basic monthly rate" value={php(e.basicMonthlyRate)} />
            <Info label="TIN" value={e.tin ?? "—"} mono />
            <Info label="SSS number" value={e.sssNumber ?? "—"} mono />
            <Info label="PhilHealth number" value={e.philHealthNumber ?? "—"} mono />
            <Info label="Pag-IBIG (HDMF)" value={e.pagIbigNumber ?? "—"} mono />
          </CardContent>
        </Card>

        {/* Projected payslip */}
        <Card>
          <CardHeader><CardTitle>Semi-monthly payslip</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2 text-sm">
            <Row label="Basic (½ month)"    value={php(projected.basicPay)} />
            <div className="my-2 border-t border-dashed border-[var(--border)]" />
            <Row label="SSS (employee)"    value={`−${php(projected.sssEE)}`} muted />
            <Row label="PhilHealth (EE)"   value={`−${php(projected.philHealthEE)}`} muted />
            <Row label="Pag-IBIG (EE)"     value={`−${php(projected.pagIbigEE)}`} muted />
            <Row label="WHT (BIR TRAIN)"   value={`−${php(projected.withholdingTax)}`} muted />
            <div className="my-2 border-t border-[var(--border)]" />
            <Row label="Net pay" value={php(projected.netPay)} bold />
            <div className="mt-3 pt-3 border-t border-dashed border-[var(--border)]">
              <div className="text-2xs text-[var(--text-tertiary)]">Employer counterpart / cutoff</div>
              <Row label="SSS (ER)"     value={php(projected.sssER)} muted />
              <Row label="PHIC (ER)"    value={php(projected.philHealthER)} muted />
              <Row label="Pag-IBIG (ER)" value={php(projected.pagIbigER)} muted />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave entitlement */}
      <Card>
        <CardHeader><CardTitle>Statutory leave entitlements</CardTitle></CardHeader>
        <CardContent className="pt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(STATUTORY_LEAVE).map(([type, info]) => {
            const ineligible = type === "SIL" && !eligibleSIL;
            return (
              <div key={type} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{type.replace("_", " ")}</span>
                  <Badge variant={ineligible ? "neutral" : "success"}>{info.days}d</Badge>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1 leading-relaxed">{info.ref}</p>
                {ineligible && (
                  <p className="text-[10px] text-[var(--warning)] mt-1">Requires 1 year of service</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent payroll */}
      {e.payrolls.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent payroll history</CardTitle></CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2">
              {e.payrolls.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div>
                    <div className="text-sm">{phDate(p.periodStart)} – {phDate(p.periodEnd)}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Gross {php(p.grossPay)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular">{php(p.netPay)}</div>
                    <Badge variant={p.status === "RELEASED" ? "success" : "neutral"}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-2xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}>
      <span className={muted ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
