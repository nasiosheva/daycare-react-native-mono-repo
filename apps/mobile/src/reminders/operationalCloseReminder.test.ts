import { describe, expect, it } from "vitest";
import { OPERATIONAL_CLOSE_REMINDER_MAX_SCHEDULED, operationalCloseReminderOccurrences } from "./operationalCloseReminder";

describe("operational close reminder occurrences", () => {
  it("uses the branch timezone and schedules 30 minutes before closing", () => {
    const occurrences = operationalCloseReminderOccurrences([
      { branchId: "branch-a", branchName: "Cabang A", timezone: "Asia/Jakarta", hours: [{ dayOfWeek: "MONDAY", active: true, closesAt: "16:00" }] },
    ], new Date("2026-10-04T23:00:00.000Z"), 2);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({ date: "2026-10-05", closesAt: "16:00" });
    expect(occurrences[0].fireAt.toISOString()).toBe("2026-10-05T08:30:00.000Z");
  });

  it("deduplicates a branch shared by multiple linked children", () => {
    const sources = [
      { branchId: "branch-a", branchName: "Cabang A", timezone: "Asia/Jakarta", hours: [{ dayOfWeek: "MONDAY", active: true, closesAt: "13:30" }] },
      { branchId: "branch-a", branchName: "Cabang A", timezone: "Asia/Jakarta", hours: [{ dayOfWeek: "MONDAY", active: true, closesAt: "13:30" }] },
    ] as const;

    expect(operationalCloseReminderOccurrences(sources, new Date("2026-10-04T23:00:00.000Z"), 2)).toHaveLength(1);
  });

  it("skips inactive, invalid, and already elapsed closing times", () => {
    const occurrences = operationalCloseReminderOccurrences([
      {
        branchId: "branch-a",
        branchName: "Cabang A",
        timezone: "Asia/Jakarta",
        hours: [
          { dayOfWeek: "MONDAY", active: false, closesAt: "16:00" },
          { dayOfWeek: "MONDAY", active: true, closesAt: "bad" },
          { dayOfWeek: "MONDAY", active: true, closesAt: "00:15" },
        ],
      },
    ], new Date("2026-10-05T00:00:00.000Z"), 1);

    expect(occurrences).toHaveLength(0);
  });

  it("keeps only the soonest reminders within the scheduling cap", () => {
    const everyDay = (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const).map((dayOfWeek) => ({ dayOfWeek, active: true, closesAt: "17:00" }));
    const sources = ["branch-a", "branch-b", "branch-c"].map((branchId) => ({ branchId, branchName: branchId, timezone: "Asia/Jakarta", hours: everyDay }));

    const occurrences = operationalCloseReminderOccurrences(sources, new Date("2026-10-04T23:00:00.000Z"), 14, 10);

    expect(occurrences).toHaveLength(10);
    expect(occurrences.map((occurrence) => occurrence.fireAt.getTime())).toEqual([...occurrences.map((occurrence) => occurrence.fireAt.getTime())].sort((a, b) => a - b));
    expect(occurrences[0].date).toBe("2026-10-05");
  });

  it("stays under the iOS pending-notification limit by default", () => {
    const everyDay = (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const).map((dayOfWeek) => ({ dayOfWeek, active: true, closesAt: "17:00" }));
    const sources = ["a", "b", "c", "d", "e"].map((branchId) => ({ branchId, branchName: branchId, timezone: "Asia/Jakarta", hours: everyDay }));

    expect(operationalCloseReminderOccurrences(sources, new Date("2026-10-04T23:00:00.000Z")).length).toBeLessThanOrEqual(OPERATIONAL_CLOSE_REMINDER_MAX_SCHEDULED);
  });
});
