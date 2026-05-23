"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Reads ?toast=message&toastType=success|error from URL, fires toast, clears params.
// Mount in any page layout that has server actions which redirect with ?toast=...
export function ToastListener() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const msg = params.get("toast");
    const type = params.get("toastType") ?? "success";
    if (!msg) return;

    if (type === "error") toast.error(msg);
    else if (type === "warning") toast.warning(msg);
    else toast.success(msg);

    // Clear params without a full navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("toastType");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [params, router]);

  return null;
}
