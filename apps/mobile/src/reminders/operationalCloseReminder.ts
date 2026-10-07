import type { OperatingDay } from "@daycare/api-client";

export type OperationalCloseReminderHour = {
  dayOfWeek: OperatingDay;
  active: boolean;
  closesAt?: string | null;
};

export type OperationalCloseReminderSource = {
  branchId: string;
  branchName: string;
  timezone: string;
  hours: readonly OperationalCloseReminderHour[];
};

export type OperationalCloseReminderOccurrence = {
  sourceKey: string;
  branchId: string;
  branchName: string;
  timezone: string;
  date: string;
  closesAt: string;
  fireAt: Date;
};

export const OPERATIONAL_CLOSE_REMINDER_MINUTES = 30;
export const OPERATIONAL_CLOSE_REMINDER_HORIZON_DAYS = 14;
/**
 * iOS keeps at most 64 pending local notifications per app and silently drops
 * the rest. Capping these reminders (soonest first) leaves room for Staff
 * reminders and other scheduled notifications.
 */
export const OPERATIONAL_CLOSE_REMINDER_MAX_SCHEDULED = 40;

const weekdayByUtcDay: readonly OperatingDay[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/**
 * Builds future absolute triggers from branch-local operating times. The
 * result is deliberately finite so changes to branch hours are reconciled
 * when Notifications is opened instead of leaving an unbounded repeating
 * trigger behind.
 */
export function operationalCloseReminderOccurrences(
  sources: readonly OperationalCloseReminderSource[],
  now = new Date(),
  horizonDays = OPERATIONAL_CLOSE_REMINDER_HORIZON_DAYS,
  maxOccurrences = OPERATIONAL_CLOSE_REMINDER_MAX_SCHEDULED,
): OperationalCloseReminderOccurrence[] {
  const uniqueSources = new Map<string, OperationalCloseReminderSource>();
  for (const source of sources) {
    if (!source.branchId || !source.timezone || !uniqueSources.has(source.branchId)) uniqueSources.set(source.branchId, source);
  }

  const occurrences: OperationalCloseReminderOccurrence[] = [];
  for (const source of uniqueSources.values()) {
    const localToday = localDateParts(now, source.timezone);
    if (!localToday) continue;
    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
      const localDate = calendarDateAfter(localToday, dayOffset);
      const weekday = weekdayByUtcDay[new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day)).getUTCDay()];
      const closingTimes = source.hours
        .filter((hour) => hour.active && hour.dayOfWeek === weekday && isValidTime(hour.closesAt))
        .map((hour) => hour.closesAt as string)
        .sort()
        .slice(-1);
      for (const closesAt of closingTimes) {
        const localClose = localDateTimeMinusMinutes(localDate, closesAt, OPERATIONAL_CLOSE_REMINDER_MINUTES);
        if (!localClose) continue;
        const fireAt = zonedDateTimeToUtc(localClose.date, localClose.time, source.timezone);
        if (!fireAt || fireAt.getTime() <= now.getTime()) continue;
        occurrences.push({
          sourceKey: source.branchId,
          branchId: source.branchId,
          branchName: source.branchName,
          timezone: source.timezone,
          date: localDateKey(localDate),
          closesAt,
          fireAt,
        });
      }
    }
  }
  return occurrences.sort((left, right) => left.fireAt.getTime() - right.fireAt.getTime()).slice(0, maxOccurrences);
}

export function isValidTime(value: string | null | undefined): value is string {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function localDateParts(value: Date, timezone: string): CalendarDate | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);
    return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) ? { year, month, day } : null;
  } catch {
    return null;
  }
}

type CalendarDate = { year: number; month: number; day: number };

function calendarDateAfter(date: CalendarDate, offset: number): CalendarDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + offset));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function localDateKey(date: CalendarDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function localDateTimeMinusMinutes(date: CalendarDate, time: string, minutes: number): { date: string; time: string } | null {
  if (!isValidTime(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day, hour, minute - minutes));
  return {
    date: `${String(value.getUTCFullYear()).padStart(4, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`,
    time: `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`,
  };
}

function zonedDateTimeToUtc(date: string, time: string, timezone: string): Date | null {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = localTimestamp;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) candidate = localTimestamp - timezoneOffsetMillis(candidate, timezone);
  } catch {
    return null;
  }
  return new Date(candidate);
}

function timezoneOffsetMillis(timestamp: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - timestamp;
}
