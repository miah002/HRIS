"use client";
import { usePathname } from "next/navigation";

export function PageEnter({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div key={path} className="animate-page-enter">
      {children}
    </div>
  );
}
