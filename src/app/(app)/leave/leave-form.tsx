"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Emp = { id: string; firstName: string; lastName: string; sex: string | null };

const SPECIAL_TYPES = [
  { value: "MATERNITY", label: "Maternity Leave (RA 11210 — 105 days)", sex: "FEMALE" },
  { value: "PATERNITY", label: "Paternity Leave (RA 8187 — 7 days)", sex: "MALE" },
];

export function StandardLeaveForm({ employees, action }: { employees: Emp[]; action: (fd: FormData) => void }) {
  return (
    <form action={action} className="grid sm:grid-cols-4 gap-3 items-end">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Employee</label>
        <select
          name="employeeId" required
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        >
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Leave type</label>
        <select
          name="leaveType" required
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        >
          <option value="VL">Vacation Leave (VL)</option>
          <option value="SL">Sick Leave (SL)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Start date</label>
        <input type="date" name="startDate" required
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">End date</label>
        <input type="date" name="endDate" required
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        />
      </div>
      <div className="sm:col-span-4 flex justify-end">
        <Button type="submit" size="sm">Submit request</Button>
      </div>
    </form>
  );
}

export function SpecialLeaveForm({ employees, action }: { employees: Emp[]; action: (fd: FormData) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const emp = employees.find((e) => e.id === selectedId);
  const availableTypes = SPECIAL_TYPES.filter((t) => !emp || emp.sex === t.sex);

  return (
    <form action={action} className="grid sm:grid-cols-4 gap-3 items-end">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Employee</label>
        <select
          name="employeeId" required
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        >
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
        {emp?.sex && (
          <Badge variant={emp.sex === "FEMALE" ? "brand" : "neutral"} className="self-start text-[10px]">
            {emp.sex}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Leave type</label>
        <select
          name="leaveType" required
          disabled={!selectedId}
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] disabled:opacity-50"
        >
          {!selectedId
            ? <option value="">— select employee first —</option>
            : availableTypes.length === 0
              ? <option value="">— no eligible leave types —</option>
              : availableTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))
          }
        </select>
        {selectedId && availableTypes.length === 0 && (
          <p className="text-[10px] text-[var(--error)]">
            {emp?.sex === "MALE" ? "Males: Paternity only" : emp?.sex === "FEMALE" ? "Females: Maternity only" : "Set employee sex first"}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Start date</label>
        <input type="date" name="startDate" required
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">End date</label>
        <input type="date" name="endDate" required
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        />
      </div>
      <div className="sm:col-span-4 flex justify-end">
        <Button type="submit" size="sm" disabled={!selectedId || availableTypes.length === 0}>
          File special leave
        </Button>
      </div>
    </form>
  );
}
