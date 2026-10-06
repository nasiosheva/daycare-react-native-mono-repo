import type { PushNotificationMuteDuration } from "@daycare/api-client";
import type { TranslationKey } from "@/i18n/translations";

export const notificationMuteDurations = ["ONE_HOUR", "ONE_WEEK", "ONE_MONTH"] as const satisfies readonly PushNotificationMuteDuration[];

export const browserNotificationMuteUntilStorageKey = "umur-emas.notifications.browser-muted-until";

export const notificationMuteDurationMilliseconds: Record<PushNotificationMuteDuration, number> = {
  ONE_HOUR: 60 * 60 * 1_000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1_000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1_000,
};

export const notificationMuteDurationKeys: Record<PushNotificationMuteDuration, TranslationKey> = {
  ONE_HOUR: "notifications.muteOneHour",
  ONE_WEEK: "notifications.muteOneWeek",
  ONE_MONTH: "notifications.muteOneMonth",
};

export function notificationPreferenceQueryKey(organizationId?: string | null) {
  return ["device-notification-preference", organizationId] as const;
}

/** True while a mute window (ISO timestamp) is still in the future; invalid or past values are not muted. */
export function isMuteActive(mutedUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!mutedUntil) return false;
  const until = Date.parse(mutedUntil);
  return Number.isFinite(until) && until > now.getTime();
}
