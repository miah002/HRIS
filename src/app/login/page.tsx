import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
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
    <main className="min-h-screen grid place-items-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Sahod HR</CardTitle>
          <CardDescription>Demo: <code>owner@demo.ph</code> / <code>demo1234</code></CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required defaultValue="owner@demo.ph" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required defaultValue="demo1234" />
            </div>
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
          <p className="mt-4 text-sm text-center text-muted-foreground">
            No account? <Link href="/register" className="text-primary underline">Create one</Link>
          </p>
          <p className="mt-2 text-sm text-center"><Link href="/" className="text-muted-foreground">← Back to home</Link></p>
        </CardContent>
      </Card>
    </main>
  );
}
