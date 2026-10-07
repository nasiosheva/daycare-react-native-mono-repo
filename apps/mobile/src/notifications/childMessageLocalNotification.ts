import { AppState } from "react-native";
import type { RealtimeEvent } from "@daycare/api-client";
import { childMessageLocalNotificationFor, isNewChildMessageEvent } from "./childMessageLocalNotificationPolicy";
import { presentLocalNotification } from "./localNotification";

/**
 * Raises a local OS notification for a new chat message received over the
 * realtime WebSocket. It only works while the app process and its socket are
 * alive; nothing is delivered once the OS closes the connection.
 */
export async function presentChildMessageLocalNotification(
  event: RealtimeEvent,
  input: { title: string; body: string; loadMutedUntil: () => Promise<string | null | undefined> },
): Promise<void> {
  if (!isNewChildMessageEvent(event)) return;
  const notification = childMessageLocalNotificationFor(event, { appIsActive: AppState.currentState === "active", mutedUntil: await input.loadMutedUntil() });
  if (!notification) return;
  await presentLocalNotification({ title: input.title, body: input.body, actionPath: notification.actionPath, organizationId: notification.organizationId, notificationId: notification.messageId });
}
