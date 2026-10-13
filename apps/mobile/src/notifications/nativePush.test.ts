// Mories Deo Hutapea,S.E.,S.Kom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platformOS: "android",
  expoProjectId: "usia-emas-project",
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  getDeviceInstallationId: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { get OS() { return mocks.platformOS; } } }));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  setNotificationChannelAsync: mocks.setNotificationChannelAsync,
  getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
}));
vi.mock("@/device/installationId", () => ({ getDeviceInstallationId: mocks.getDeviceInstallationId }));
vi.mock("@/config/env", () => ({ env: { get expoProjectId() { return mocks.expoProjectId; } } }));

import {
  defaultNotificationChannelId,
  ensureDefaultNotificationChannel,
  getNativeNotificationPermission,
  nativeNotificationPlatform,
  registerNativePushDevice,
  requestNativeNotificationPermission,
  type NativeNotificationPermission,
} from "./nativePush";

const grantedPermission = { status: "granted" } as NativeNotificationPermission;
const deniedPermission = { status: "denied" } as NativeNotificationPermission;

describe("native push notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platformOS = "android";
    mocks.expoProjectId = "usia-emas-project";
    mocks.getPermissionsAsync.mockResolvedValue(deniedPermission);
    mocks.requestPermissionsAsync.mockResolvedValue(grantedPermission);
    mocks.setNotificationChannelAsync.mockResolvedValue(undefined);
    mocks.getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" });
    mocks.getDeviceInstallationId.mockResolvedValue("installation-123");
  });

  it("recognizes native platforms and excludes web from permission APIs", async () => {
    expect(nativeNotificationPlatform()).toBe("android");
    mocks.platformOS = "ios";
    expect(nativeNotificationPlatform()).toBe("ios");

    mocks.platformOS = "web";
    expect(nativeNotificationPlatform()).toBeNull();
    await expect(getNativeNotificationPermission()).resolves.toBeNull();
    await expect(requestNativeNotificationPermission()).resolves.toBeNull();
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission only when the current native permission is not granted", async () => {
    await expect(requestNativeNotificationPermission()).resolves.toBe(grantedPermission);
    expect(mocks.getPermissionsAsync).toHaveBeenCalledOnce();
    expect(mocks.requestPermissionsAsync).toHaveBeenCalledOnce();

    mocks.getPermissionsAsync.mockResolvedValueOnce(grantedPermission);
    await expect(requestNativeNotificationPermission()).resolves.toBe(grantedPermission);
    expect(mocks.requestPermissionsAsync).toHaveBeenCalledOnce();
  });

  it("creates the default channel on Android and registers the granted device", async () => {
    const registerDevice = vi.fn().mockResolvedValue(undefined);
    const timeZoneSpy = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ timeZone: "Asia/Jakarta" } as Intl.ResolvedDateTimeFormatOptions);

    await expect(registerNativePushDevice({ registerDevice }, grantedPermission)).resolves.toBe(true);

    expect(mocks.setNotificationChannelAsync).toHaveBeenCalledWith(defaultNotificationChannelId, {
      name: "Default",
      importance: 3,
    });
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "usia-emas-project" });
    expect(registerDevice).toHaveBeenCalledWith({
      token: "ExponentPushToken[test]",
      platform: "android",
      installationId: "installation-123",
      timeZone: "Asia/Jakarta",
    });
    timeZoneSpy.mockRestore();
  });

  it("registers iOS without creating an Android channel", async () => {
    mocks.platformOS = "ios";
    const registerDevice = vi.fn().mockResolvedValue(undefined);

    await expect(registerNativePushDevice({ registerDevice }, grantedPermission)).resolves.toBe(true);

    expect(mocks.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({ platform: "ios" }));
  });

  it("skips device registration without native platform, permission, or project ID", async () => {
    const registerDevice = vi.fn();
    mocks.platformOS = "web";
    await expect(registerNativePushDevice({ registerDevice }, grantedPermission)).resolves.toBe(false);
    mocks.platformOS = "android";
    await expect(registerNativePushDevice({ registerDevice }, deniedPermission)).resolves.toBe(false);
    mocks.expoProjectId = "";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(registerNativePushDevice({ registerDevice }, grantedPermission)).resolves.toBe(false);

    expect(registerDevice).not.toHaveBeenCalled();
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("does not swallow token or API registration failures", async () => {
    mocks.getExpoPushTokenAsync.mockRejectedValueOnce(new Error("Expo token unavailable"));
    await expect(registerNativePushDevice({ registerDevice: vi.fn() }, grantedPermission)).rejects.toThrow("Expo token unavailable");

    const registerDevice = vi.fn().mockRejectedValue(new Error("API unavailable"));
    await expect(registerNativePushDevice({ registerDevice }, grantedPermission)).rejects.toThrow("API unavailable");
  });

  it("does not configure a channel on iOS or web", async () => {
    mocks.platformOS = "ios";
    await ensureDefaultNotificationChannel();
    mocks.platformOS = "web";
    await ensureDefaultNotificationChannel();

    expect(mocks.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});
