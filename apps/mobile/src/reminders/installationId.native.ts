import * as SecureStore from "expo-secure-store";

const storageKey = "umur-emas.reminders.installation-id";

function createInstallationId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export async function getReminderInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(storageKey);
  if (existing) return existing;
  const installationId = createInstallationId();
  await SecureStore.setItemAsync(storageKey, installationId);
  return installationId;
}
