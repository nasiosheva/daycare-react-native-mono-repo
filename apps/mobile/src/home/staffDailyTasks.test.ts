import { describe, expect, it } from "vitest";
import { createStaffChildDailyTasks } from "./staffDailyTasks";

describe("createStaffChildDailyTasks", () => {
  it("marks only today's development and incomplete active goal indicators as pending", () => {
    const result = createStaffChildDailyTasks(
      [{ recordedAt: "2026-07-23T02:00:00.000Z" }] as never,
      [
        { name: "Toilet training", status: "ACTIVE", indicators: [{ id: "dry", active: true }, { id: "ask", active: true }], checkIns: [{ indicatorId: "dry", date: "2026-07-23" }] },
        { name: "Completed", status: "COMPLETED", indicators: [{ id: "done", active: true }], checkIns: [] },
      ] as never,
      "2026-07-23",
    );

    expect(result).toEqual({ developmentRecorded: true, activeGoalCount: 1, pendingGoalNames: ["Toilet training"] });
  });
});
