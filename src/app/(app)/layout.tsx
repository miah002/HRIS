import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, BottomNav } from "@/components/nav";
import { ToastListener } from "@/components/toast-listener";
import { PageEnter } from "@/components/ui/page-enter";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const role = user?.role ?? "OWNER";
  const name = session.user?.name ?? session.user?.email ?? "User";

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={name} role={role} />
      <main className="flex-1 min-h-screen overflow-x-hidden">
        <div className="px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8 max-w-[1200px]">
          <PageEnter>{children}</PageEnter>
        </div>
      </main>
      <BottomNav role={role} />
      <Suspense><ToastListener /></Suspense>
    </div>
  );
}
