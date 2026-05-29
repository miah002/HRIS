import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Field } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Pencil } from "lucide-react";

async function updateEmployee(id: string, formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  if (!companyId) redirect("/dashboard");

  // Capture current values for change-diffing
  const current = await prisma.employee.findUnique({
    where: { id },
    select: { companyId: true, position: true, department: true, employmentStatus: true, basicMonthlyRate: true },
  });
  if (!current || current.companyId !== companyId) redirect("/employees");

  const newPosition   = String(formData.get("position"));
  const newDept       = String(formData.get("department"));
  const newStatus     = String(formData.get("employmentStatus"));
  const newRate       = Number(formData.get("basicMonthlyRate"));
  const effectiveDate = formData.get("effectiveDate")
    ? new Date(String(formData.get("effectiveDate")))
    : new Date();
  const changeNotes   = (formData.get("changeNotes") as string) || undefined;

  await prisma.employee.update({
    where: { id },
    data: {
      firstName: String(formData.get("firstName")),
      middleName: (formData.get("middleName") as string) || null,
      lastName: String(formData.get("lastName")),
      email: (formData.get("email") as string) || null,
      mobile: (formData.get("mobile") as string) || null,
      birthDate: formData.get("birthDate") ? new Date(String(formData.get("birthDate"))) : null,
      dateHired: new Date(String(formData.get("dateHired"))),
      position: newPosition,
      department: newDept,
      employmentStatus: newStatus,
      basicMonthlyRate: newRate,
      hdmfMp2Monthly: Number(formData.get("hdmfMp2Monthly")) || 0,
      tin: (formData.get("tin") as string) || null,
      sssNumber: (formData.get("sssNumber") as string) || null,
      philHealthNumber: (formData.get("philHealthNumber") as string) || null,
      pagIbigNumber: (formData.get("pagIbigNumber") as string) || null,
      sex:          (formData.get("sex")          as string) || null,
      civilStatus:  (formData.get("civilStatus")  as string) || null,
      addressStreet:   (formData.get("addressStreet")   as string) || null,
      addressCity:     (formData.get("addressCity")     as string) || null,
      addressProvince: (formData.get("addressProvince") as string) || null,
      addressZip:      (formData.get("addressZip")      as string) || null,
    },
  });

  // Upsert primary emergency contact if name provided
  const ecName = (formData.get("ecName") as string)?.trim();
  if (ecName) {
    await prisma.emergencyContact.upsert({
      where: { employeeId_isPrimary: { employeeId: id, isPrimary: true } },
      update: {
        name: ecName,
        relationship: (formData.get("ecRelationship") as string) || "",
        phone: (formData.get("ecPhone") as string) || "",
        email: (formData.get("ecEmail") as string) || null,
      },
      create: {
        employeeId: id,
        name: ecName,
        relationship: (formData.get("ecRelationship") as string) || "",
        phone: (formData.get("ecPhone") as string) || "",
        email: (formData.get("ecEmail") as string) || null,
        isPrimary: true,
      },
    });
  }

  // Change-diffing: build history entries
  const posChanged  = newPosition !== current.position;
  const rateChanged = newRate !== current.basicMonthlyRate;
  const deptChanged = newDept !== current.department;
  const statChanged = newStatus !== current.employmentStatus;

  if (posChanged && rateChanged) {
    await prisma.employeeHistory.create({
      data: {
        employeeId: id,
        type: "PROMOTION",
        effectiveDate,
        fromValue: `${current.position} | ₱${current.basicMonthlyRate.toLocaleString()}`,
        toValue:   `${newPosition} | ₱${newRate.toLocaleString()}`,
        notes: changeNotes,
      },
    });
  } else {
    const entries: {
      employeeId: string; type: string; effectiveDate: Date;
      field?: string; fromValue?: string; toValue?: string; notes?: string;
    }[] = [];
    if (posChanged)  entries.push({ employeeId: id, type: "POSITION_CHANGE",     effectiveDate, field: "position",         fromValue: current.position,                          toValue: newPosition,             notes: changeNotes });
    if (rateChanged) entries.push({ employeeId: id, type: "SALARY_CHANGE",       effectiveDate, field: "basicMonthlyRate", fromValue: `₱${current.basicMonthlyRate.toLocaleString()}`, toValue: `₱${newRate.toLocaleString()}`, notes: changeNotes });
    if (deptChanged) entries.push({ employeeId: id, type: "DEPARTMENT_TRANSFER", effectiveDate, field: "department",       fromValue: current.department,                        toValue: newDept,                 notes: changeNotes });
    if (statChanged) entries.push({ employeeId: id, type: "STATUS_CHANGE",       effectiveDate, field: "employmentStatus", fromValue: current.employmentStatus,                  toValue: newStatus,               notes: changeNotes });
    if (entries.length > 0) await prisma.employeeHistory.createMany({ data: entries });
  }

  redirect(`/employees/${id}?toast=Employee+updated+successfully`);
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.employee.findUnique({
    where: { id },
    include: { emergencyContacts: { where: { isPrimary: true }, take: 1 } },
  });
  if (!e) notFound();
  const primaryEC = e.emergencyContacts[0] ?? null;

  const action = updateEmployee.bind(null, id);
  const dateHiredValue  = e.dateHired.toISOString().split("T")[0];
  const birthDateValue  = e.birthDate ? e.birthDate.toISOString().split("T")[0] : "";

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
            <F label="Birth date" name="birthDate" type="date" defaultValue={birthDateValue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Home address</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <F label="Street / Barangay" name="addressStreet" className="md:col-span-2" defaultValue={e.addressStreet ?? ""} />
            <F label="City / Municipality" name="addressCity" defaultValue={e.addressCity ?? ""} />
            <F label="Province" name="addressProvince" defaultValue={e.addressProvince ?? ""} />
            <F label="ZIP code" name="addressZip" placeholder="4-digit ZIP" defaultValue={e.addressZip ?? ""} />
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hdmfMp2Monthly">HDMF MP2 (monthly)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">₱</span>
                <Input
                  id="hdmfMp2Monthly" name="hdmfMp2Monthly" type="number"
                  min="0" step="100" className="pl-7 tabular"
                  defaultValue={e.hdmfMp2Monthly ?? 0}
                  placeholder="0"
                />
              </div>
            </div>
            <F label="Effective date of change" name="effectiveDate" type="date" className="md:col-span-1"
               defaultValue={new Date().toISOString().split("T")[0]} />
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="changeNotes">Reason / notes for this change</Label>
              <textarea id="changeNotes" name="changeNotes" rows={2} placeholder="e.g. Regularization, Annual increment…"
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] resize-none"
              />
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

        <Card>
          <CardHeader>
            <CardTitle>Emergency contact</CardTitle>
            <CardDescription>Primary contact in case of emergency.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <F label="Full name" name="ecName" defaultValue={primaryEC?.name ?? ""} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ecRelationship">Relationship</Label>
              <select id="ecRelationship" name="ecRelationship" defaultValue={primaryEC?.relationship ?? ""}
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">— Select —</option>
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Child">Child</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <F label="Mobile number" name="ecPhone" type="tel" placeholder="+639..." defaultValue={primaryEC?.phone ?? ""} />
            <F label="Email (optional)" name="ecEmail" type="email" defaultValue={primaryEC?.email ?? ""} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Link href={`/employees/${id}`}><Button type="button" variant="secondary">Cancel</Button></Link>
          <SubmitButton>Save changes</SubmitButton>
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
