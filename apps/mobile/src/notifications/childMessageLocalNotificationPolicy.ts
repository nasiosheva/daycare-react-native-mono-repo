import type { ChildMessageRealtimePayload, RealtimeEvent } from "@daycare/api-client";
import { createLocalNotificationDeduper, isActiveLocalNotificationScope, localNotificationScopeKey } from "./localNotificationContent";
import { isMuteActive } from "./mutePreferences";

export type ChildMessageLocalNotification = { organizationId: string; childId: string; messageId: string; actionPath: string };

const notifiedMessages = createLocalNotificationDeduper();

/** Scope the chat screen registers so its own thread does not raise a notification while open. */
export function childMessageNotificationScope(organizationId: string, childId: string): string {
  return localNotificationScopeKey("child-messages", organizationId, childId);
}

export function childMessageActionPath(childId: string): string {
  return `/child-messages?${new URLSearchParams({ childId }).toString()}`;
}

/** Cheap pre-check so read receipts never trigger permission or mute lookups. */
export function isNewChildMessageEvent(event: Pick<RealtimeEvent<unknown>, "flags" | "payload">): boolean {
  return event.flags.includes("CHILD_MESSAGES") && readPayload(event.payload)?.event === "MESSAGE_CREATED";
}

/**
 * Decides whether a realtime event should become a local OS notification.
 * Only a new incoming message (MESSAGE_CREATED) qualifies; read receipts reuse
 * the CHILD_MESSAGES flag and must stay silent. A message is skipped when the
 * device is muted, the user is already looking at that thread, or it was
 * already notified.
 */
export function childMessageLocalNotificationFor(
  event: Pick<RealtimeEvent<unknown>, "flags" | "organizationId" | "payload">,
  context: { appIsActive: boolean; mutedUntil?: string | null; now?: Date },
): ChildMessageLocalNotification | null {
  if (!isNewChildMessageEvent(event)) return null;
  const payload = readPayload(event.payload);
  const organizationId = event.organizationId;
  if (!payload || !organizationId) return null;
  if (isMuteActive(context.mutedUntil, context.now)) return null;
  if (context.appIsActive && isActiveLocalNotificationScope(childMessageNotificationScope(organizationId, payload.childId))) return null;
  if (!notifiedMessages.claim(payload.messageId)) return null;
  return { organizationId, childId: payload.childId, messageId: payload.messageId, actionPath: childMessageActionPath(payload.childId) };
}

export function resetChildMessageLocalNotificationState(): void {
  notifiedMessages.clear();
}

function readPayload(value: unknown): ChildMessageRealtimePayload | null {
  if (!value || typeof value !== "object") return null;
  const { childId, messageId, event } = value as Partial<ChildMessageRealtimePayload>;
  if (typeof childId !== "string" || !childId || typeof messageId !== "string" || !messageId) return null;
  return { childId, messageId, event };
}
