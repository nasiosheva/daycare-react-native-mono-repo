import * as Notifications from "expo-notifications";
import type { SchedulableNotificationTriggerInput } from "expo-notifications";
import { claimNotificationDisplay, localNotificationContent, type LocalNotificationInput } from "./localNotificationContent";
import { defaultNotificationChannelId, ensureDefaultNotificationChannel, getNativeNotificationPermission, nativeNotificationPlatform } from "./nativePush";

export * from "./localNotificationContent";

/**
 * Shows a native local notification immediately. Returns false on web or when
 * the OS permission is not granted, so callers can treat it as best-effort.
 */
export async function presentLocalNotification(input: LocalNotificationInput): Promise<boolean> {
  const platform = nativeNotificationPlatform();
  if (!platform) return false;
  const permission = await getNativeNotificationPermission();
  if (permission?.status !== "granted") return false;
  if (!claimNotificationDisplay(input.notificationId)) return false;
  await ensureDefaultNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: localNotificationContent(input),
    trigger: platform === "android" ? { channelId: defaultNotificationChannelId } : null,
  });
  return true;
}

/** Schedules a native local notification for later and returns its OS identifier. */
export async function scheduleLocalNotification(input: LocalNotificationInput, trigger: SchedulableNotificationTriggerInput): Promise<string> {
  await ensureDefaultNotificationChannel();
  return Notifications.scheduleNotificationAsync({
    content: localNotificationContent(input),
    trigger: nativeNotificationPlatform() === "android" ? { ...trigger, channelId: trigger.channelId ?? defaultNotificationChannelId } : trigger,
  });
}

export async function cancelLocalNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
