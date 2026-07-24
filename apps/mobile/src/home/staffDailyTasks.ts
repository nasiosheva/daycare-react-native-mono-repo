import type { ChildGoal, DevelopmentEntry } from "@daycare/api-client";

export type StaffChildDailyTasks = {
  developmentRecorded: boolean;
  activeGoalCount: number;
  pendingGoalNames: string[];
};

export function createStaffChildDailyTasks(entries: readonly DevelopmentEntry[], goals: readonly ChildGoal[], today: string): StaffChildDailyTasks {
  const activeGoals = goals.filter((goal) => goal.status === "ACTIVE");
  return {
    developmentRecorded: entries.some((entry) => localIsoDate(entry.recordedAt) === today),
    activeGoalCount: activeGoals.length,
    pendingGoalNames: activeGoals.filter((goal) => hasIncompleteIndicator(goal, today)).map((goal) => goal.name),
  };
}

function hasIncompleteIndicator(goal: ChildGoal, today: string): boolean {
  const activeIndicators = goal.indicators.filter((indicator) => indicator.active);
  return activeIndicators.some((indicator) => !goal.checkIns.some((checkIn) => checkIn.indicatorId === indicator.id && checkIn.date === today));
}

function localIsoDate(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
