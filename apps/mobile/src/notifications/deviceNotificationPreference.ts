import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@daycare/api-client";
import { getDeviceInstallationId } from "@/device/installationId";
import { notificationPreferenceQueryKey } from "./mutePreferences";

const DEVICE_NOTIFICATION_PREFERENCE_STALE_MILLIS = 60_000;

/** Shared query for this installation's notification preference, used by the settings UI and local notifications. */
export function deviceNotificationPreferenceQuery(api: ApiClient, organizationId?: string | null) {
  return {
    queryKey: notificationPreferenceQueryKey(organizationId),
    queryFn: async () => api.deviceNotificationPreference(await getDeviceInstallationId()),
    staleTime: DEVICE_NOTIFICATION_PREFERENCE_STALE_MILLIS,
  };
}

/**
 * Reads the device mute window through the React Query cache. A device that
 * was never registered cannot have been muted, so a failed lookup reads as
 * "not muted" rather than blocking the notification.
 */
export async function loadDeviceNotificationMutedUntil(queryClient: QueryClient, api: ApiClient, organizationId?: string | null): Promise<string | null | undefined> {
  if (!organizationId) return undefined;
  try {
    return (await queryClient.fetchQuery(deviceNotificationPreferenceQuery(api, organizationId))).pushMutedUntil;
  } catch {
    return undefined;
  }
}
