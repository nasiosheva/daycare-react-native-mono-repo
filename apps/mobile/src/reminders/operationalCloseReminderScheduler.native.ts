import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { cancelLocalNotification, scheduleLocalNotification } from "@/notifications/localNotification";
import type { LocalNotificationInput } from "@/notifications/localNotificationContent";
import type { NativeNotificationPermission } from "@/notifications/nativePush";
import { operationalCloseReminderOccurrences, type OperationalCloseReminderSource } from "./operationalCloseReminder";

const storageKey = "usia-emas.notifications.operational-close-reminder.schedules";
const scheduleRuleVersion = 1;

type StoredSchedules = { ruleVersion: number; notificationIds: string[] };
type NotificationContentFactory = (input: { branchName: string; closesAt: string; date: string }) => Pick<LocalNotificationInput, "title" | "body">;

export async function reconcileOperationalCloseReminderSchedules(
  sources: readonly OperationalCloseReminderSource[],
  permission: NativeNotificationPermission | null,
  content: NotificationContentFactory,
  now = new Date(),
): Promise<void> {
  const previous = await readStoredSchedules();
  await Promise.all(previous.notificationIds.map((notificationId) => cancelLocalNotification(notificationId).catch(() => undefined)));
  if (permission?.status !== "granted") {
    await clearStoredSchedules();
    return;
  }

  const notificationIds: string[] = [];
  for (const occurrence of operationalCloseReminderOccurrences(sources, now)) {
    const notification = content(occurrence);
    const notificationId = await scheduleLocalNotification({ ...notification, notificationId: `operational-close:${occurrence.sourceKey}:${occurrence.date}` }, {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: occurrence.fireAt,
    });
    notificationIds.push(notificationId);
  }
  await SecureStore.setItemAsync(storageKey, JSON.stringify({ ruleVersion: scheduleRuleVersion, notificationIds } satisfies StoredSchedules));
}

export async function cancelOperationalCloseReminderSchedules(): Promise<void> {
  const previous = await readStoredSchedules();
  await Promise.all(previous.notificationIds.map((notificationId) => cancelLocalNotification(notificationId).catch(() => undefined)));
  await clearStoredSchedules();
}

async function readStoredSchedules(): Promise<StoredSchedules> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey);
    if (!raw) return { ruleVersion: scheduleRuleVersion, notificationIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoredSchedules>;
    return { ruleVersion: scheduleRuleVersion, notificationIds: Array.isArray(parsed.notificationIds) ? parsed.notificationIds.filter((id): id is string => typeof id === "string") : [] };
  } catch {
    return { ruleVersion: scheduleRuleVersion, notificationIds: [] };
  }
}

async function clearStoredSchedules(): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey).catch(() => undefined);
}
