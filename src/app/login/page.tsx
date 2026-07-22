import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { signIn } from "@/lib/auth";
import { Input, Field } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

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
        <div className="flex flex-col items-center gap-3 mb-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/mmtsi-logo.png" alt="MMTSI" className="h-12 w-auto object-contain drop-shadow-sm" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">MMTSI HRIS</span>
              <span className="text-xs text-[var(--text-tertiary)] leading-tight">HR Information System</span>
            </div>
          </Link>
        </div>

        <Card variant="raised" className="overflow-hidden">
          {/* Brand accent bar */}
          <div className="h-1 bg-gradient-to-r from-[var(--brand)] via-[var(--brand-bright)] to-[var(--brand-dim)]" />
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
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  <Input id="email" name="email" type="email" required defaultValue="owner@demo.ph" autoComplete="email" className="pl-9" />
                </div>
              </Field>
              <Field label="Password" name="password">
                <PasswordInput id="password" name="password" required defaultValue="demo1234" autoComplete="current-password" />
              </Field>
              <SubmitButton className="w-full mt-2">Sign in</SubmitButton>
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
