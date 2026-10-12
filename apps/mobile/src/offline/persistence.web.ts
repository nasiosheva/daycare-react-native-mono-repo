// Mories Deo Hutapea,S.E.,S.Kom

export async function readOfflineValue(key: string): Promise<string | null> {
  return globalThis.localStorage?.getItem(key) ?? null;
}

export async function writeOfflineValue(key: string, value: string): Promise<void> {
  globalThis.localStorage?.setItem(key, value);
}

export async function deleteOfflineValue(key: string): Promise<void> {
  globalThis.localStorage?.removeItem(key);
}

