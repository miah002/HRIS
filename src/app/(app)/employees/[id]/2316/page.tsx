import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { phDate, php } from "@/lib/format";
import { ChevronLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";

export default async function BIR2316Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const e = await prisma.employee.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!e || !e.company) notFound();

  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()));
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const payrolls = await prisma.payroll.findMany({
    where: { employeeId: id, periodStart: { gte: yearStart }, periodEnd: { lte: yearEnd } },
  });

  const co = e.company;

  const annualGross       = payrolls.reduce((s, p) => s + p.grossPay, 0);
  const annualBasic       = payrolls.reduce((s, p) => s + p.basicPay, 0);
  const annualOT          = payrolls.reduce((s, p) => s + p.overtimePay, 0);
  const annualND          = payrolls.reduce((s, p) => s + p.nightDiffPay, 0);
  const annualHoliday     = payrolls.reduce((s, p) => s + p.holidayPay, 0);
  const annualSSS         = payrolls.reduce((s, p) => s + p.sssEE, 0);
  const annualPhilHealth  = payrolls.reduce((s, p) => s + p.philHealthEE, 0);
  const annualPagIbig     = payrolls.reduce((s, p) => s + p.pagIbigEE, 0);
  const annualWHT         = payrolls.reduce((s, p) => s + p.withholdingTax, 0);
  const annualNonTaxAdj   = payrolls.reduce((s, p) => s + p.nonTaxableAdjustments, 0);

  const totalMandatoryDed = annualSSS + annualPhilHealth + annualPagIbig;
  // 13th month + other benefits within ₱90k cap (stored in nonTaxableAdjustments)
  const thirteenthMonthExempt = Math.min(annualNonTaxAdj, 90000);
  const totalNonTaxable   = totalMandatoryDed + thirteenthMonthExempt;
  const taxableGross      = Math.max(annualGross - totalNonTaxable, 0);

  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/employees/${id}`} className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Back to profile
        </Link>
        <div className="flex items-center gap-2">
          <select
            value={year}
            // navigate via form to avoid client component
            onChange={() => {}}
            className="h-7 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)] focus:outline-none print:hidden"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex gap-1">
            {years.map((y) => (
              <a
                key={y}
                href={`/employees/${id}/2316?year=${y}`}
                className={`px-2 py-1 rounded text-xs border transition-colors ${y === year ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "border-[var(--border)] hover:bg-[var(--neutral-bg)]"}`}
              >
                {y}
              </a>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      <div id="payslip" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-10 space-y-6 print:border-0">
        {/* Letterhead */}
        <div className="text-center space-y-1 pb-4 border-b border-[var(--border)]">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] mb-2">Republic of the Philippines — Bureau of Internal Revenue</div>
          <div className="text-xl font-bold tracking-wide uppercase">BIR Form 2316</div>
          <div className="text-sm font-semibold">Certificate of Compensation Payment / Tax Withheld</div>
          <div className="text-xs text-[var(--text-tertiary)]">For the calendar year January 1 – December 31, {year}</div>
        </div>

        {/* Part I — Employee */}
        <section className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border)] pb-1">Part I — Employee Information</div>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ["Full Name", `${e.lastName}, ${e.firstName}${e.middleName ? " " + e.middleName : ""}`],
                ["Employee No.", e.employeeNumber],
                ["TIN", e.tin ?? "—"],
                ["SSS No.", e.sssNumber ?? "—"],
                ["PhilHealth No.", e.philHealthNumber ?? "—"],
                ["Pag-IBIG MID", e.pagIbigNumber ?? "—"],
                ["Position / Title", e.position],
                ["Department", e.department],
                ["Employment Status", e.employmentStatus],
                ["Date Hired", phDate(e.dateHired)],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1.5 pr-6 text-xs font-medium text-[var(--text-secondary)] w-44">{label}</td>
                  <td className="py-1.5 text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Part II — Employer */}
        <section className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border)] pb-1">Part II — Employer Information</div>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ["Employer Name", co.name],
                ["TIN", co.tin ?? "—"],
                ["Address", co.address ?? "—"],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1.5 pr-6 text-xs font-medium text-[var(--text-secondary)] w-44">{label}</td>
                  <td className="py-1.5 text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Part IV-B — Compensation Breakdown */}
        <section className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border)] pb-1">Part IV-B — Compensation Breakdown ({year})</div>

          <div className="space-y-4">
            {/* Earnings */}
            <div>
              <div className="text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">Gross Compensation Income</div>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {[
                    ["Basic Salary", annualBasic],
                    ["Overtime Pay", annualOT],
                    ["Night Shift Differential", annualND],
                    ["Holiday Pay / Premium Pay", annualHoliday],
                  ].map(([label, value]) => (
                    <tr key={label as string} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5 pr-6 text-[var(--text-secondary)] w-64">{label}</td>
                      <td className="py-1.5 text-right tabular-nums">{php(value as number)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)]">
                    <td className="py-2 pr-6 font-semibold">Total Gross Compensation</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{php(annualGross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Non-taxable */}
            <div>
              <div className="text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">Less: Non-Taxable / Exempt</div>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {[
                    ["SSS Contributions (EE)", annualSSS],
                    ["PhilHealth Contributions (EE)", annualPhilHealth],
                    ["Pag-IBIG Contributions (EE)", annualPagIbig],
                    [`13th Month & Other Benefits (within ₱90,000 cap)`, thirteenthMonthExempt],
                  ].map(([label, value]) => (
                    <tr key={label as string} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5 pr-6 text-[var(--text-secondary)] w-64">{label}</td>
                      <td className="py-1.5 text-right tabular-nums">({php(value as number)})</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)]">
                    <td className="py-2 pr-6 font-semibold">Total Non-Taxable</td>
                    <td className="py-2 text-right tabular-nums font-semibold">({php(totalNonTaxable)})</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Taxable + Tax */}
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b border-[var(--border)] bg-[var(--brand-subtle)]">
                  <td className="py-2 px-2 font-semibold text-xs">Taxable Compensation Income</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-xs">{php(taxableGross)}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-6 text-xs font-medium text-[var(--text-secondary)]">Total Tax Withheld</td>
                  <td className="py-2 text-right tabular-nums text-xs font-semibold">{php(annualWHT)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Signature block */}
        <div className="pt-6 grid grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
              <div className="border-b border-[var(--text-primary)] w-48 mb-1" />
              <div className="text-xs font-medium">Authorized Signatory</div>
              <div className="text-xs text-[var(--text-tertiary)]">HR Manager / Owner</div>
              <div className="text-xs text-[var(--text-tertiary)]">{co.name}</div>
            </div>
            <div>
              <div className="border-b border-[var(--text-primary)] w-48 mb-1" />
              <div className="text-xs font-medium">Employee Signature</div>
              <div className="text-xs text-[var(--text-tertiary)]">{e.firstName} {e.lastName}</div>
            </div>
          </div>
          <div className="text-right text-xs text-[var(--text-tertiary)] space-y-1">
            <div>Issued: {phDate(new Date())}</div>
            <div>Calendar Year: {year}</div>
            {co.tin && <div>Employer TIN: {co.tin}</div>}
            <div className="mt-2 text-[10px]">Payroll periods computed: {payrolls.length}</div>
          </div>
        </div>

        <div className="pt-4 border-t border-dashed border-[var(--border)] text-center">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            System-generated BIR Form 2316 · MMTSI HRIS · {co.name} · {phDate(new Date())}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            Values based on payroll records. Verify with actual payroll registers before filing with BIR.
          </p>
        </div>
      </div>
    </div>
  );
}
