import type { NotificationContentInput } from "expo-notifications";

/**
 * Platform-free building blocks shared by every local notification feature
 * (chat, reminders, and future realtime-driven notices). Keep Expo runtime
 * calls in localNotification.ts so these rules stay unit-testable.
 */
export type LocalNotificationInput = {
  title: string;
  body: string;
  /** Route opened by NotificationRouteHandler when the notification is tapped. */
  actionPath?: string;
  /** Tenant the action belongs to; the route handler re-validates access against it. */
  organizationId?: string | null;
};

/**
 * The single source of the notification `data` contract. Server pushes use the
 * same `{ actionPath, organizationId }` shape, so one tap handler serves all.
 */
export function localNotificationContent(input: LocalNotificationInput): NotificationContentInput {
  const data: Record<string, string> = {};
  if (input.actionPath) data.actionPath = input.actionPath;
  if (input.organizationId) data.organizationId = input.organizationId;
  return { title: input.title, body: input.body, sound: "default", data };
}

/** Builds a stable key for a screen/resource that can suppress its own notifications. */
export function localNotificationScopeKey(feature: string, ...parts: readonly string[]): string {
  return [feature, ...parts].join(":");
}

let activeScopeKey: string | null = null;

/** A focused screen registers its scope so notifications about what the user is already viewing stay silent. */
export function setActiveLocalNotificationScope(scopeKey: string | null): void {
  activeScopeKey = scopeKey;
}

export function isActiveLocalNotificationScope(scopeKey: string): boolean {
  return activeScopeKey === scopeKey;
}

/** Remembers recently notified ids so replayed realtime events do not notify twice. */
export function createLocalNotificationDeduper(capacity = 200) {
  const ids = new Set<string>();
  return {
    /** Returns true the first time an id is claimed, false afterwards. */
    claim(id: string): boolean {
      if (ids.has(id)) return false;
      ids.add(id);
      if (ids.size > capacity) {
        const oldest = ids.values().next().value;
        if (oldest !== undefined) ids.delete(oldest);
      }
      return true;
    },
    clear(): void {
      ids.clear();
    },
  };
}
