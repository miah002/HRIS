import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function createEmployee(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/dashboard");

  const count = await prisma.employee.count({ where: { companyId: user.companyId } });
  const empNo = `EMP-${String(count + 1).padStart(4, "0")}`;

  await prisma.employee.create({
    data: {
      companyId: user.companyId,
      employeeNumber: empNo,
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
    },
  });
  redirect("/employees");
}

export default function NewEmployeePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link href="/employees" className="text-sm text-muted-foreground hover:underline">← Back to employees</Link>
        <h1 className="text-2xl font-bold mt-1">Add employee</h1>
        <p className="text-sm text-muted-foreground">Creates a 201 file. Government IDs are optional at hiring but required for payroll remittance.</p>
      </div>

      <form action={createEmployee} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal details</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <Field label="First name *" name="firstName" required />
            <Field label="Middle name" name="middleName" />
            <Field label="Last name *" name="lastName" required />
            <Field label="Email" name="email" type="email" />
            <Field label="Mobile" name="mobile" placeholder="+639..." />
            <Field label="Date hired *" name="dateHired" type="date" required />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <Field label="Position *" name="position" required />
            <Field label="Department *" name="department" required />
            <div className="space-y-1.5">
              <Label htmlFor="employmentStatus">Employment status *</Label>
              <select id="employmentStatus" name="employmentStatus" required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="REGULAR">Regular</option>
                <option value="PROBATIONARY">Probationary</option>
                <option value="PROJECT">Project-based (DO 174)</option>
                <option value="CASUAL">Casual</option>
                <option value="CONTRACTUAL">Contractual (DO 174)</option>
              </select>
            </div>
            <Field label="Basic monthly rate (₱) *" name="basicMonthlyRate" type="number" min="0" step="100" required />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Government IDs</CardTitle>
            <p className="text-xs text-muted-foreground">Used for SSS/PhilHealth/Pag-IBIG remittance and BIR 2316 / 1601-C reporting.</p>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            <Field label="TIN" name="tin" placeholder="123-456-789-000" />
            <Field label="SSS number" name="sssNumber" placeholder="XX-XXXXXXX-X" />
            <Field label="PhilHealth number" name="philHealthNumber" placeholder="XX-XXXXXXXXX-X" />
            <Field label="Pag-IBIG (HDMF) number" name="pagIbigNumber" placeholder="XXXX-XXXX-XXXX" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Link href="/employees"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit">Save employee</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
