import type { LocalAuthSession } from "./localAuth";

const storageKey = "daycare.auth.local-session";

export async function loadLocalSession(): Promise<LocalAuthSession | null> {
  const value = globalThis.localStorage?.getItem(storageKey) ?? null;
  return value ? JSON.parse(value) as LocalAuthSession : null;
}

export async function saveLocalSession(session: LocalAuthSession): Promise<void> { globalThis.localStorage?.setItem(storageKey, JSON.stringify(session)); }
export async function clearLocalSession(): Promise<void> { globalThis.localStorage?.removeItem(storageKey); }
