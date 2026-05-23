import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", { email, password, redirect: false });
    } catch {
      redirect("/login?error=1");
    }
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen gradient-mesh grid place-items-center p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-2">
            <img src="/mmtsi-logo.png" alt="MMTSI" className="h-8 w-auto object-contain" />
            <span className="font-semibold text-[var(--text-primary)]">MMTSI HRIS</span>
          </Link>
        </div>

        <Card variant="raised">
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>
              Demo: <code className="text-[10px] bg-[var(--neutral-bg)] px-1.5 py-0.5 rounded">owner@demo.ph</code> /{" "}
              <code className="text-[10px] bg-[var(--neutral-bg)] px-1.5 py-0.5 rounded">demo1234</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={login} className="space-y-4">
              <Field label="Email address" name="email">
                <Input id="email" name="email" type="email" required defaultValue="owner@demo.ph" autoComplete="email" />
              </Field>
              <Field label="Password" name="password">
                <Input id="password" name="password" type="password" required defaultValue="demo1234" autoComplete="current-password" />
              </Field>
              <Button type="submit" className="w-full mt-2">Sign in</Button>
            </form>
            <p className="mt-5 text-xs text-center text-[var(--text-tertiary)]">
              No account?{" "}
              <Link href="/register" className="text-[var(--brand)] hover:underline">Create one free</Link>
            </p>
            <p className="mt-1 text-xs text-center">
              <Link href="/" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">← Back to home</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
