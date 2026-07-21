import * as SecureStore from "expo-secure-store";
import type { LocalAuthSession } from "./localAuth";

const storageKey = "daycare.auth.local-session";

export async function loadLocalSession(): Promise<LocalAuthSession | null> {
  const value = await SecureStore.getItemAsync(storageKey);
  return value ? JSON.parse(value) as LocalAuthSession : null;
}

export function saveLocalSession(session: LocalAuthSession): Promise<void> { return SecureStore.setItemAsync(storageKey, JSON.stringify(session)); }
export function clearLocalSession(): Promise<void> { return SecureStore.deleteItemAsync(storageKey); }
