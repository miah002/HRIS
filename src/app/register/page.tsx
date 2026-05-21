import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  async function register(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");
    const companyName = String(formData.get("company") ?? "");
    if (!email || !password || !companyName) redirect("/register?error=missing");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect("/register?error=exists");

    const company = await prisma.company.create({ data: { name: companyName } });
    await prisma.user.create({
      data: { email, name, password: await bcrypt.hash(password, 10), companyId: company.id, role: "OWNER" },
    });
    await signIn("credentials", { email, password, redirect: false });
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your Sahod HR account</CardTitle>
          <CardDescription>Free for up to 10 employees.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={register} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company name</Label>
              <Input id="company" name="company" required placeholder="e.g. Aling Nena's Carinderia" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            <Button type="submit" className="w-full">Create account</Button>
          </form>
          <p className="mt-4 text-sm text-center text-muted-foreground">
            Already have an account? <Link href="/login" className="text-primary underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
