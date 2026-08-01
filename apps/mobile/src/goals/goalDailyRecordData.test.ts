import { describe, expect, it } from "vitest";
import { buildGoalDailyRecordData, type GoalDailyRecordInput } from "./goalDailyRecordData";

const baseGoal = {
  indicators: [{ id: "one", active: true }, { id: "two", active: true }, { id: "archived", active: false }],
} satisfies Omit<GoalDailyRecordInput, "checkIns">;

describe("buildGoalDailyRecordData", () => {
  it("shows partial daily results without treating them as a complete day", () => {
    const result = buildGoalDailyRecordData({
      ...baseGoal,
      checkIns: [
        { indicatorId: "one", date: "2026-08-01", outcome: "YES" },
        { indicatorId: "archived", date: "2026-08-01", outcome: "NO" },
      ],
    });

    expect(result).toEqual({
      activeIndicatorCount: 2,
      days: [{
        date: "2026-08-01",
        outcomes: { one: "YES", two: null },
        recordedIndicatorCount: 1,
        yesCount: 1,
        noCount: 0,
      }],
    });
  });

  it("orders the newest recorded day first", () => {
    const result = buildGoalDailyRecordData({
      ...baseGoal,
      checkIns: [
        { indicatorId: "one", date: "2026-08-01", outcome: "YES" },
        { indicatorId: "one", date: "2026-08-02", outcome: "NO" },
      ],
    });

    expect(result.days.map((day) => day.date)).toEqual(["2026-08-02", "2026-08-01"]);
  });
});
