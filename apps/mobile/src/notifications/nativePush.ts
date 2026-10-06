import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { getDeviceInstallationId } from "@/device/installationId";
import { env } from "@/config/env";

export type NativeNotificationPlatform = "ios" | "android";
export type NativeNotificationPermission = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

export interface NativeDeviceRegistrar {
  registerDevice(input: {
    token: string;
    platform: NativeNotificationPlatform;
    installationId: string;
    timeZone: string;
  }): Promise<void>;
}

export function nativeNotificationPlatform(): NativeNotificationPlatform | null {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
}

/**
 * Checks and, when needed, requests the OS permission. Web is deliberately
 * excluded; browsers use Notification.requestPermission through the web
 * notification adapter and require a user gesture.
 */
export async function getNativeNotificationPermission(): Promise<NativeNotificationPermission | null> {
  if (!nativeNotificationPlatform()) return null;
  return Notifications.getPermissionsAsync();
}

export async function requestNativeNotificationPermission(): Promise<NativeNotificationPermission | null> {
  const current = await getNativeNotificationPermission();
  if (!current || current.status === "granted") return current;
  return Notifications.requestPermissionsAsync();
}

export const defaultNotificationChannelId = "default";

/** Android needs a channel before any remote or local notification is shown; other platforms no-op. */
export async function ensureDefaultNotificationChannel(): Promise<void> {
  if (nativeNotificationPlatform() !== "android") return;
  await Notifications.setNotificationChannelAsync(defaultNotificationChannelId, {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function registerNativePushDevice(
  api: NativeDeviceRegistrar,
  permission: NativeNotificationPermission,
): Promise<boolean> {
  const platform = nativeNotificationPlatform();
  if (!platform || permission.status !== "granted") return false;
  if (!env.expoProjectId) {
    console.warn("[notifications] EXPO_PUBLIC_EXPO_PROJECT_ID is not configured; skipping native Expo push registration.");
    return false;
  }
  await ensureDefaultNotificationChannel();
  const [token, installationId] = await Promise.all([
    Notifications.getExpoPushTokenAsync({ projectId: env.expoProjectId }),
    getDeviceInstallationId(),
  ]);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  await api.registerDevice({ token: token.data, platform, installationId, timeZone });
  return true;
}
