"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button size="sm" variant="secondary" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" />
      Print / Save PDF
    </Button>
  );
}
