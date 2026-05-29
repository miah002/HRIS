"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "@/components/ui/label";
import { UserX } from "lucide-react";

const SEPARATION_TYPES = [
  { value: "RESIGNED",        label: "Resigned" },
  { value: "RETIRED",         label: "Retired" },
  { value: "END_OF_CONTRACT", label: "End of Contract" },
  { value: "TERMINATED",      label: "Terminated (for cause)" },
  { value: "REDUNDANCY",      label: "Redundancy" },
  { value: "RETRENCHMENT",    label: "Retrenchment" },
  { value: "DEATH",           label: "Death" },
];

interface Props {
  employeeId: string;
  minDate: string; // dateHired ISO date string YYYY-MM-DD
  separateAction: (formData: FormData) => Promise<void>;
}

export function SeparateModal({ employeeId, minDate, separateAction }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        <UserX className="h-3.5 w-3.5" /> Separate
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !pending && setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--error-subtle,_#fef2f2)] grid place-items-center">
                <UserX className="h-4 w-4 text-[var(--error)]" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Separate employee</h2>
                <p className="text-xs text-[var(--text-tertiary)]">This will archive the employee and record their separation.</p>
              </div>
            </div>

            <form
              action={(fd) => startTransition(() => separateAction(fd))}
              className="space-y-4"
            >
              <input type="hidden" name="employeeId" value={employeeId} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="separationType">Separation type <span className="text-[var(--error)]">*</span></Label>
                <select id="separationType" name="separationType" required
                  className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                >
                  <option value="">— Select type —</option>
                  {SEPARATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="separationDate">Separation date <span className="text-[var(--error)]">*</span></Label>
                <input
                  type="date" id="separationDate" name="separationDate" required
                  min={minDate}
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="separationNotes">Notes (optional)</Label>
                <textarea id="separationNotes" name="separationNotes" rows={3} placeholder="Reason, last day details…"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <SubmitButton variant="danger" disabled={pending}>
                  {pending ? "Saving…" : "Confirm separation"}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
