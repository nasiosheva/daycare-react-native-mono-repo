import * as SecureStore from "expo-secure-store";
import type { AppLocale } from "./translations";

const storageKey = "daycare.locale";

export function loadLocale(): Promise<string | null> { return SecureStore.getItemAsync(storageKey); }
export function saveLocale(locale: AppLocale): Promise<void> { return SecureStore.setItemAsync(storageKey, locale); }
