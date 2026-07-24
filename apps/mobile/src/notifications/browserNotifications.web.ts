import type { AppNotification, PushNotificationMuteDuration } from "@daycare/api-client";
import { browserNotificationMuteUntilStorageKey, notificationMuteDurationMilliseconds } from "./mutePreferences";

export function browserNotificationMutedUntil(): string | undefined {
  const value = readMutedUntil();
  if (!value || Number.isNaN(Date.parse(value)) || Date.parse(value) <= Date.now()) {
    removeMutedUntil();
    return undefined;
  }
  return value;
}

export function muteBrowserNotifications(duration: PushNotificationMuteDuration): string | undefined {
  const mutedUntil = new Date(Date.now() + notificationMuteDurationMilliseconds[duration]).toISOString();
  try { globalThis.localStorage?.setItem(browserNotificationMuteUntilStorageKey, mutedUntil); }
  catch { return undefined; }
  return mutedUntil;
}

export function unmuteBrowserNotifications(): void {
  removeMutedUntil();
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  try {
    if (!("Notification" in globalThis)) return false;
    if (globalThis.Notification.permission === "granted") return true;
    return globalThis.Notification.permission === "default" && (await globalThis.Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export async function showBrowserNotification(loadNotifications: () => Promise<AppNotification[]>, notificationId?: string): Promise<void> {
  if (browserNotificationMutedUntil() || !("Notification" in globalThis) || globalThis.Notification.permission !== "granted") return;
  try {
    const notifications = await loadNotifications();
    const notification = notificationId
      ? notifications.find((item) => item.id === notificationId && item.readAt == null)
      : notifications.find((item) => item.readAt == null);
    if (notification) new globalThis.Notification(notification.title, { body: notification.body });
  } catch {
    // Browser notifications are an enhancement; inbox and realtime invalidation remain independent.
  }
}

function readMutedUntil(): string | undefined {
  try { return globalThis.localStorage?.getItem(browserNotificationMuteUntilStorageKey) ?? undefined; }
  catch { return undefined; }
}

function removeMutedUntil(): void {
  try { globalThis.localStorage?.removeItem(browserNotificationMuteUntilStorageKey); }
  catch { /* Browser storage can be disabled by privacy settings. */ }
}
