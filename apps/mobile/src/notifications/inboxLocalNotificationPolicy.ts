import type { RealtimeEvent } from "@daycare/api-client";
import { isActiveLocalNotificationScope, localNotificationScopeKey } from "./localNotificationContent";
import { isMuteActive } from "./mutePreferences";

/** Scope the inbox screen registers so new items are not announced while the user is reading the inbox. */
export const inboxNotificationScope = localNotificationScopeKey("notifications");

/** The inbox notification id carried by a NOTIFICATIONS realtime event, if any. */
export function inboxNotificationIdFrom(event: Pick<RealtimeEvent<unknown>, "flags" | "payload">): string | null {
  if (!event.flags.includes("NOTIFICATIONS") || !event.payload || typeof event.payload !== "object") return null;
  const notificationId = (event.payload as { notificationId?: unknown }).notificationId;
  return typeof notificationId === "string" && notificationId ? notificationId : null;
}

/** Skips the local notification while the device is muted or the inbox is open in the foreground. */
export function shouldPresentInboxLocalNotification(context: { appIsActive: boolean; mutedUntil?: string | null; now?: Date }): boolean {
  if (isMuteActive(context.mutedUntil, context.now)) return false;
  return !(context.appIsActive && isActiveLocalNotificationScope(inboxNotificationScope));
}
