import type { AppNotification, PushNotificationMuteDuration } from "@daycare/api-client";

export function browserNotificationMutedUntil(): string | undefined { return undefined; }
export function muteBrowserNotifications(_duration: PushNotificationMuteDuration): string | undefined { return undefined; }
export function unmuteBrowserNotifications(): void {}
export async function requestBrowserNotificationPermission(): Promise<boolean> { return false; }
export async function showBrowserNotification(_loadNotifications: () => Promise<AppNotification[]>, _notificationId?: string): Promise<void> {}
