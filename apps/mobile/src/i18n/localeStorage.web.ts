import type { AppLocale } from "./translations";

const storageKey = "daycare.locale";

export async function loadLocale(): Promise<string | null> { return globalThis.localStorage?.getItem(storageKey) ?? null; }
export async function saveLocale(locale: AppLocale): Promise<void> { globalThis.localStorage?.setItem(storageKey, locale); }
