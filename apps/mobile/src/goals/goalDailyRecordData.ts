import type { GoalCheckInOutcome } from "@daycare/core";

export type GoalDailyRecordInput = {
  indicators: ReadonlyArray<{ id: string; active: boolean }>;
  checkIns: ReadonlyArray<{ indicatorId: string; date: string; outcome: GoalCheckInOutcome }>;
};

export type GoalDailyRecord = {
  date: string;
  outcomes: Readonly<Record<string, GoalCheckInOutcome | null>>;
  recordedIndicatorCount: number;
  yesCount: number;
  noCount: number;
};

export type GoalDailyRecordData = {
  activeIndicatorCount: number;
  days: GoalDailyRecord[];
};

export function buildGoalDailyRecordData(goal: GoalDailyRecordInput): GoalDailyRecordData {
  const activeIndicatorIds = goal.indicators.filter((indicator) => indicator.active).map((indicator) => indicator.id);
  const activeIndicatorIdSet = new Set(activeIndicatorIds);
  const outcomesByDate = new Map<string, Map<string, GoalCheckInOutcome>>();

  goal.checkIns.forEach((checkIn) => {
    if (!activeIndicatorIdSet.has(checkIn.indicatorId)) return;
    const outcomes = outcomesByDate.get(checkIn.date) ?? new Map<string, GoalCheckInOutcome>();
    outcomes.set(checkIn.indicatorId, checkIn.outcome);
    outcomesByDate.set(checkIn.date, outcomes);
  });

  return {
    activeIndicatorCount: activeIndicatorIds.length,
    days: [...outcomesByDate.entries()].sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate)).map(([date, outcomes]) => {
      const result = Object.fromEntries(activeIndicatorIds.map((indicatorId) => [indicatorId, outcomes.get(indicatorId) ?? null]));
      const values = Object.values(result);
      return {
        date,
        outcomes: result,
        recordedIndicatorCount: values.filter((outcome) => outcome != null).length,
        yesCount: values.filter((outcome) => outcome === "YES").length,
        noCount: values.filter((outcome) => outcome === "NO").length,
      };
    }),
  };
}
