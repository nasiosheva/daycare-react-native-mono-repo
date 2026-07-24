import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import type { StaffReminder } from "@daycare/api-client";

const storageKey = "umur-emas.reminders.local-schedules";
type StoredSchedules = Record<string, { ruleVersion: number; notificationIds: string[] }>;
export type ReminderScheduleAcknowledgement = { reminderId: string; ruleVersion: number; scheduled: boolean };

async function loadSchedules(): Promise<StoredSchedules> {
  const raw = await SecureStore.getItemAsync(storageKey);
  return raw ? JSON.parse(raw) as StoredSchedules : {};
}

export async function reconcileLocalReminderSchedules(reminders: readonly StaffReminder[], organizationId: string): Promise<ReminderScheduleAcknowledgement[]> {
  const stored = await loadSchedules();
  const next: StoredSchedules = {};
  const acknowledgements: ReminderScheduleAcknowledgement[] = [];
  const reminderIds = new Set(reminders.map((reminder) => reminder.id));
  await Promise.all(Object.entries(stored).filter(([reminderId]) => !reminderIds.has(reminderId)).flatMap(([, schedule]) => schedule.notificationIds.map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined))));
  for (const reminder of reminders) {
    const previous = stored[reminder.id];
    const unchanged = reminder.active && previous?.ruleVersion === reminder.ruleVersion;
    if (unchanged) {
      next[reminder.id] = previous;
      acknowledgements.push({ reminderId: reminder.id, ruleVersion: reminder.ruleVersion, scheduled: true });
      continue;
    }
    await Promise.all((previous?.notificationIds ?? []).map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined)));
    if (!reminder.active) {
      acknowledgements.push({ reminderId: reminder.id, ruleVersion: reminder.ruleVersion, scheduled: false });
      continue;
    }
    try {
      const notificationIds = await Promise.all(reminder.weekdays.map((weekday) => Notifications.scheduleNotificationAsync({
        content: { title: reminder.title, body: reminder.description, sound: "default", data: { actionPath: reminderPath(reminder.target), organizationId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: reminder.hour, minute: reminder.minute },
      })));
      next[reminder.id] = { ruleVersion: reminder.ruleVersion, notificationIds };
      acknowledgements.push({ reminderId: reminder.id, ruleVersion: reminder.ruleVersion, scheduled: true });
    } catch {
      acknowledgements.push({ reminderId: reminder.id, ruleVersion: reminder.ruleVersion, scheduled: false });
    }
  }
  await SecureStore.setItemAsync(storageKey, JSON.stringify(next));
  return acknowledgements;
}

function reminderPath(target: StaffReminder["target"]): string {
  switch (target) {
    case "ATTENDANCE": return "/attendance";
    case "DEVELOPMENT": return "/development";
    case "CHILDREN": return "/children";
    case "BOOKING_APPROVALS": return "/booking-approvals";
    case "HOME": return "/home";
  }
}
