import * as SecureStore from "expo-secure-store";

const storageKey = "usia-emas.notifications.operational-close-reminder.enabled";

export async function loadOperationalCloseReminderEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(storageKey);
    return value == null ? true : value === "true";
  } catch {
    return true;
  }
}

export function saveOperationalCloseReminderEnabled(enabled: boolean): Promise<void> {
  return SecureStore.setItemAsync(storageKey, String(enabled));
}
