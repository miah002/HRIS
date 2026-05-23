export type PHHolidayType = "RH" | "SH";

export interface PHHoliday {
  date: string; // "YYYY-MM-DD"
  name: string;
  type: PHHolidayType;
}

const PH_HOLIDAYS: PHHoliday[] = [
  // 2025 Regular Holidays
  { date: "2025-01-01", name: "New Year's Day",                     type: "RH" },
  { date: "2025-04-09", name: "Araw ng Kagitingan",                 type: "RH" },
  { date: "2025-04-17", name: "Maundy Thursday",                    type: "RH" },
  { date: "2025-04-18", name: "Good Friday",                        type: "RH" },
  { date: "2025-05-01", name: "Labor Day",                          type: "RH" },
  { date: "2025-06-12", name: "Independence Day",                   type: "RH" },
  { date: "2025-08-25", name: "National Heroes Day",                type: "RH" },
  { date: "2025-11-30", name: "Bonifacio Day",                      type: "RH" },
  { date: "2025-12-25", name: "Christmas Day",                      type: "RH" },
  { date: "2025-12-30", name: "Rizal Day",                          type: "RH" },
  // 2025 Special Non-Working Holidays
  { date: "2025-01-29", name: "Chinese New Year",                   type: "SH" },
  { date: "2025-02-25", name: "EDSA People Power Revolution",       type: "SH" },
  { date: "2025-04-19", name: "Black Saturday",                     type: "SH" },
  { date: "2025-08-21", name: "Ninoy Aquino Day",                   type: "SH" },
  { date: "2025-11-01", name: "All Saints' Day",                    type: "SH" },
  { date: "2025-11-02", name: "All Souls' Day",                     type: "SH" },
  { date: "2025-12-08", name: "Feast of the Immaculate Conception", type: "SH" },
  { date: "2025-12-24", name: "Christmas Eve",                      type: "SH" },
  { date: "2025-12-31", name: "New Year's Eve",                     type: "SH" },
  // 2026 Regular Holidays
  { date: "2026-01-01", name: "New Year's Day",                     type: "RH" },
  { date: "2026-04-02", name: "Maundy Thursday",                    type: "RH" },
  { date: "2026-04-03", name: "Good Friday",                        type: "RH" },
  { date: "2026-04-09", name: "Araw ng Kagitingan",                 type: "RH" },
  { date: "2026-05-01", name: "Labor Day",                          type: "RH" },
  { date: "2026-06-12", name: "Independence Day",                   type: "RH" },
  { date: "2026-08-31", name: "National Heroes Day",                type: "RH" },
  { date: "2026-11-30", name: "Bonifacio Day",                      type: "RH" },
  { date: "2026-12-25", name: "Christmas Day",                      type: "RH" },
  { date: "2026-12-30", name: "Rizal Day",                          type: "RH" },
  // 2026 Special Non-Working Holidays
  { date: "2026-01-28", name: "Chinese New Year",                   type: "SH" },
  { date: "2026-02-25", name: "EDSA People Power Revolution",       type: "SH" },
  { date: "2026-04-04", name: "Black Saturday",                     type: "SH" },
  { date: "2026-08-21", name: "Ninoy Aquino Day",                   type: "SH" },
  { date: "2026-11-01", name: "All Saints' Day",                    type: "SH" },
  { date: "2026-11-02", name: "All Souls' Day",                     type: "SH" },
  { date: "2026-12-08", name: "Feast of the Immaculate Conception", type: "SH" },
  { date: "2026-12-24", name: "Christmas Eve",                      type: "SH" },
  { date: "2026-12-31", name: "New Year's Eve",                     type: "SH" },
];

const holidayMap = new Map(PH_HOLIDAYS.map((h) => [h.date, h]));

export function getPHHoliday(date: Date): PHHoliday | null {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return holidayMap.get(`${y}-${m}-${d}`) ?? null;
}
