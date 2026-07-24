import * as SecureStore from "expo-secure-store";
import { DEVICE_INSTALLATION_ID_STORAGE_KEY } from "./installationIdConstants";

function createInstallationId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export async function getDeviceInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_INSTALLATION_ID_STORAGE_KEY);
  if (existing) return existing;
  const installationId = createInstallationId();
  await SecureStore.setItemAsync(DEVICE_INSTALLATION_ID_STORAGE_KEY, installationId);
  return installationId;
}
