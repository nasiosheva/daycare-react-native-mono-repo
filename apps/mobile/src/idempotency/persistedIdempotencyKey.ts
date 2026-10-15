// Mories Deo Hutapea,S.E.,S.Kom
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createIdempotencyKey } from "./createIdempotencyKey";

const pendingWrites = new Map<string, Promise<string>>();

export async function getOrCreateIdempotencyKey(storageKey: string): Promise<string> {
  const pending = pendingWrites.get(storageKey);
  if (pending) return pending;
  const operation = (async () => {
    const existing = Platform.OS === "web" ? globalThis.localStorage?.getItem(storageKey) ?? null : await SecureStore.getItemAsync(storageKey);
    if (existing) return existing;
    const created = createIdempotencyKey();
    if (Platform.OS === "web") globalThis.localStorage?.setItem(storageKey, created);
    else await SecureStore.setItemAsync(storageKey, created);
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
  else await SecureStore.deleteItemAsync(storageKey);
}
