import type { StaffReminder } from "@daycare/api-client";

export type ReminderScheduleAcknowledgement = { reminderId: string; ruleVersion: number; scheduled: boolean };

export async function reconcileLocalReminderSchedules(reminders: readonly StaffReminder[], _organizationId: string): Promise<ReminderScheduleAcknowledgement[]> {
  return reminders.map((reminder) => ({ reminderId: reminder.id, ruleVersion: reminder.ruleVersion, scheduled: false }));
}
