import { DEVICE_INSTALLATION_ID_STORAGE_KEY } from "./installationIdConstants";

function createInstallationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getDeviceInstallationId(): Promise<string> {
  const existing = globalThis.localStorage?.getItem(DEVICE_INSTALLATION_ID_STORAGE_KEY) ?? null;
  if (existing) return existing;
  const installationId = createInstallationId();
  globalThis.localStorage?.setItem(DEVICE_INSTALLATION_ID_STORAGE_KEY, installationId);
  return installationId;
}
