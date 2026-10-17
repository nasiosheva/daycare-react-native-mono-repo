// Mories Deo Hutapea,S.E.,S.Kom
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createIdempotencyKey } from "./createIdempotencyKey";

const pendingWrites = new Map<string, Promise<string>>();

function toSecureStoreKey(storageKey: string): string {
  const safeKey = Array.from(storageKey, (character) => {
    if (/^[A-Za-z0-9.-]$/.test(character)) return character;
    return `_${character.codePointAt(0)?.toString(16)}_`;
  }).join("");
  return `idempotency.${safeKey}`;
}

function secureStoreKey(storageKey: string): string {
  return Platform.OS === "android" ? toSecureStoreKey(storageKey) : storageKey;
}

export async function getOrCreateIdempotencyKey(storageKey: string): Promise<string> {
  const pending = pendingWrites.get(storageKey);
  if (pending) return pending;
  const operation = (async () => {
    const existing = Platform.OS === "web"
      ? globalThis.localStorage?.getItem(storageKey) ?? null
      : await SecureStore.getItemAsync(secureStoreKey(storageKey));
    if (existing) return existing;
    const created = createIdempotencyKey();
    if (Platform.OS === "web") globalThis.localStorage?.setItem(storageKey, created);
    else await SecureStore.setItemAsync(secureStoreKey(storageKey), created);
    return created;
  })();
  pendingWrites.set(storageKey, operation);
  try {
    return await operation;
  } finally {
    pendingWrites.delete(storageKey);
  }
}

export async function removeIdempotencyKey(storageKey: string): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage?.removeItem(storageKey);
  else await SecureStore.deleteItemAsync(secureStoreKey(storageKey));
}
