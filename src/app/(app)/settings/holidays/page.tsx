import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { phDate } from "@/lib/format";
import { getPHHoliday } from "@/lib/ph-holidays";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

const PH_OFFICIAL = (() => {
  const year = new Date().getFullYear();
  const dates: { date: string; name: string; type: string }[] = [];
  // Generate from the static library for current + next year
  for (let y = year; y <= year + 1; y++) {
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 31; d++) {
        try {
          const dt = new Date(y, m - 1, d);
          if (dt.getMonth() !== m - 1) break;
          const h = getPHHoliday(dt);
          if (h) dates.push({ date: h.date, name: h.name, type: h.type });
        } catch { break; }
      }
    }
  }
  return dates;
})();

async function addHoliday(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  if (!user?.companyId) redirect("/settings");
  const name = String(formData.get("name")).trim();
  const date = new Date(String(formData.get("date")) + "T00:00:00+00:00");
  const type = String(formData.get("type"));
  if (!name || !formData.get("date")) redirect("/settings/holidays");
  await prisma.holiday.upsert({
    where: { companyId_date: { companyId: user.companyId, date } },
    update: { name, type },
    create: { companyId: user.companyId, name, date, type },
  });
  redirect("/settings/holidays?toast=Holiday+added");
}

async function deleteHoliday(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const id = String(formData.get("id"));
  await prisma.holiday.delete({ where: { id } });
  redirect("/settings/holidays?toast=Holiday+removed");
}

export default async function HolidaysPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });

  const customHolidays = user?.companyId
    ? await prisma.holiday.findMany({
        where: { companyId: user.companyId },
        orderBy: { date: "asc" },
      })
    : [];

  const customDates = new Set(customHolidays.map((h) => h.date.toISOString().slice(0, 10)));
  const upcomingOfficial = PH_OFFICIAL.filter((h) => {
    const d = new Date(h.date + "T00:00:00");
    return d >= new Date() && !customDates.has(h.date);
  }).slice(0, 20);

  const TYPE_LABEL: Record<string, string> = { RH: "Regular Holiday", SH: "Special Non-Working" };
  const TYPE_BADGE: Record<string, "error" | "warning"> = { RH: "error", SH: "warning" };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[var(--text-tertiary)]" />
            <h1 className="text-2xl font-semibold tracking-tight">Holiday calendar</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            PH official holidays + custom proclamations. Used for OT rate auto-detection in attendance.
          </p>
        </div>
        <Link href="/settings" className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">← Settings</Link>
      </div>

      {/* Add custom holiday */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4 text-[var(--brand)]" />
            Add custom / local holiday
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <form action={addHoliday} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Date</label>
              <input type="date" name="date" required
                className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Holiday name</label>
              <input type="text" name="name" placeholder="e.g. Founder's Day" required
                className="h-8 w-56 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Type</label>
              <select name="type" defaultValue="SH"
                className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]">
                <option value="RH">Regular Holiday</option>
                <option value="SH">Special Non-Working</option>
              </select>
            </div>
            <SubmitButton size="sm"><Plus className="h-3.5 w-3.5" />Add holiday</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Custom holidays */}
      {customHolidays.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Custom / local holidays</CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2">
            {customHolidays.map((h) => {
              const delFn = deleteHoliday.bind(null);
              return (
                <div key={h.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant={TYPE_BADGE[h.type] ?? "neutral"}>{TYPE_LABEL[h.type] ?? h.type}</Badge>
                    <div>
                      <div className="text-sm font-medium">{h.name}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{phDate(h.date)}</div>
                    </div>
                  </div>
                  <form action={delFn}>
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton size="sm" variant="secondary" className="text-[var(--error)]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </SubmitButton>
                  </form>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* PH official upcoming */}
      <Card>
        <CardHeader><CardTitle>PH official holidays — upcoming</CardTitle></CardHeader>
        <CardContent className="pt-3 space-y-2">
          {upcomingOfficial.map((h) => (
            <div key={h.date} className="flex items-center gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
              <Badge variant={TYPE_BADGE[h.type] ?? "neutral"}>{h.type}</Badge>
              <div>
                <div className="text-sm font-medium">{h.name}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{h.date}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
