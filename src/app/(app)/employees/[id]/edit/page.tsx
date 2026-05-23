import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Pencil } from "lucide-react";

async function updateEmployee(id: string, formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.employee.update({
    where: { id },
    data: {
      firstName: String(formData.get("firstName")),
      middleName: (formData.get("middleName") as string) || null,
      lastName: String(formData.get("lastName")),
      email: (formData.get("email") as string) || null,
      mobile: (formData.get("mobile") as string) || null,
      dateHired: new Date(String(formData.get("dateHired"))),
      position: String(formData.get("position")),
      department: String(formData.get("department")),
      employmentStatus: String(formData.get("employmentStatus")),
      basicMonthlyRate: Number(formData.get("basicMonthlyRate")),
      tin: (formData.get("tin") as string) || null,
      sssNumber: (formData.get("sssNumber") as string) || null,
      philHealthNumber: (formData.get("philHealthNumber") as string) || null,
      pagIbigNumber: (formData.get("pagIbigNumber") as string) || null,
      sex:          (formData.get("sex")          as string) || null,
      civilStatus:  (formData.get("civilStatus")  as string) || null,
    },
  });
  redirect(`/employees/${id}`);
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.employee.findUnique({ where: { id } });
  if (!e) notFound();

  const action = updateEmployee.bind(null, id);
  const dateHiredValue = e.dateHired.toISOString().split("T")[0];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <Link href={`/employees/${id}`} className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-3">
          <ChevronLeft className="h-3 w-3" /> Back to profile
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--brand-subtle)] grid place-items-center">
            <Pencil className="h-4 w-4 text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Edit employee</h1>
            <p className="text-xs text-[var(--text-tertiary)]">{e.firstName} {e.lastName} · {e.employeeNumber}</p>
          </div>
        </div>
      </div>

      <form action={action} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <F label="First name" name="firstName" required defaultValue={e.firstName} />
            <F label="Middle name" name="middleName" defaultValue={e.middleName ?? ""} />
            <F label="Last name" name="lastName" required defaultValue={e.lastName} />
            <F label="Email address" name="email" type="email" className="md:col-span-2" defaultValue={e.email ?? ""} />
            <F label="Mobile (+63)" name="mobile" placeholder="+639..." defaultValue={e.mobile ?? ""} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sex">Sex</Label>
              <select id="sex" name="sex" defaultValue={e.sex ?? ""}
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">— Not specified —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="civilStatus">Civil status</Label>
              <select id="civilStatus" name="civilStatus" defaultValue={e.civilStatus ?? ""}
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">— Not specified —</option>
                <option value="SINGLE">Single</option>
                <option value="MARRIED">Married</option>
                <option value="WIDOWED">Widowed</option>
                <option value="SEPARATED">Separated</option>
              </select>
            </div>
            <F label="Date hired" name="dateHired" type="date" required defaultValue={dateHiredValue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>Status determines leave eligibility and DO 174 contracting compliance.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <F label="Position" name="position" required defaultValue={e.position} />
            <F label="Department" name="department" required defaultValue={e.department} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employmentStatus">
                Employment status <span className="text-[var(--error)]">*</span>
              </Label>
              <select
                id="employmentStatus" name="employmentStatus" required
                defaultValue={e.employmentStatus}
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="REGULAR">Regular</option>
                <option value="PROBATIONARY">Probationary (up to 6 months)</option>
                <option value="PROJECT">Project-based (DOLE DO 174)</option>
                <option value="CASUAL">Casual</option>
                <option value="CONTRACTUAL">Contractual (DOLE DO 174)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="basicMonthlyRate">
                Basic monthly rate <span className="text-[var(--error)]">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">₱</span>
                <Input
                  id="basicMonthlyRate" name="basicMonthlyRate" type="number"
                  min="0" step="100" required className="pl-7 tabular"
                  defaultValue={e.basicMonthlyRate}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Government IDs</CardTitle>
            <CardDescription>Required for SSS/PhilHealth/Pag-IBIG remittance and BIR 2316 / 1601-C.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <F label="TIN" name="tin" placeholder="123-456-789-000" defaultValue={e.tin ?? ""} />
            <F label="SSS number" name="sssNumber" placeholder="XX-XXXXXXX-X" defaultValue={e.sssNumber ?? ""} />
            <F label="PhilHealth number" name="philHealthNumber" placeholder="XX-XXXXXXXXX-X" defaultValue={e.philHealthNumber ?? ""} />
            <F label="Pag-IBIG (HDMF) number" name="pagIbigNumber" placeholder="XXXX-XXXX-XXXX" defaultValue={e.pagIbigNumber ?? ""} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Link href={`/employees/${id}`}><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </div>
  );
}

function F({ label, name, className, ...props }: { label: string; name: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { required, ...rest } = props;
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}{required && <span className="ml-0.5 text-[var(--error)]">*</span>}</Label>
      <Input id={name} name={name} required={required} {...rest} />
    </div>
  );
}
