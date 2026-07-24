import type { AppNotification } from "@daycare/api-client";

export const NOTIFICATION_BADGE_MAX_COUNT = 9;

export function unreadNotificationCount(notifications: readonly Pick<AppNotification, "readAt">[]): number {
  return notifications.filter((notification) => notification.readAt == null).length;
}

export function unreadNotificationBadge(unreadCount: number): string | undefined {
  if (unreadCount === 0) return undefined;
  return unreadCount > NOTIFICATION_BADGE_MAX_COUNT ? `${NOTIFICATION_BADGE_MAX_COUNT}+` : String(unreadCount);
}
