import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar, BottomNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <div className="md:flex">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-20 md:pb-0">
        <div className="container py-6 md:py-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
