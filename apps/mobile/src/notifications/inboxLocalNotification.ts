import { AppState } from "react-native";
import type { AppNotification, RealtimeEvent } from "@daycare/api-client";
import { inboxNotificationIdFrom, shouldPresentInboxLocalNotification } from "./inboxLocalNotificationPolicy";
import { presentLocalNotification } from "./localNotification";

/**
 * Shows a native local notification for a new inbox item announced over the
 * realtime WebSocket, so payment, booking, health, and other inbox events reach
 * the OS tray while the app is alive even without server push delivery. The
 * stored inbox item supplies the localized title, body, and action path.
 */
export async function presentInboxLocalNotification(
  event: RealtimeEvent,
  input: {
    loadNotification: (notificationId: string) => Promise<AppNotification | undefined>;
    loadMutedUntil: () => Promise<string | null | undefined>;
  },
): Promise<void> {
  const notificationId = inboxNotificationIdFrom(event);
  if (!notificationId) return;
  if (!shouldPresentInboxLocalNotification({ appIsActive: AppState.currentState === "active", mutedUntil: await input.loadMutedUntil() })) return;
  const notification = await input.loadNotification(notificationId);
  if (!notification || notification.readAt) return;
  await presentLocalNotification({
    title: notification.title,
    body: notification.body,
    actionPath: notification.actionPath ?? undefined,
    organizationId: event.organizationId,
    notificationId,
  });
}
