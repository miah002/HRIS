import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar, BottomNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const name = session.user?.name ?? session.user?.email ?? "Owner";

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={name} />
      <main className="flex-1 min-h-screen overflow-x-hidden">
        {/* Main content — padded for bottom nav on mobile */}
        <div className="px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8 max-w-[1200px]">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
