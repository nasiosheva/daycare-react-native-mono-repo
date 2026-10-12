// Mories Deo Hutapea,S.E.,S.Kom

import * as SecureStore from "expo-secure-store";

const chunkSize = 1_800;

export async function readOfflineValue(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(`${key}.meta`);
  if (!meta) return null;
  const parsed = JSON.parse(meta) as { chunks?: number };
  const chunks = typeof parsed.chunks === "number" && Number.isInteger(parsed.chunks) ? parsed.chunks : 0;
  if (chunks <= 0) return null;
  const values = await Promise.all(Array.from({ length: chunks }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)));
  return values.every(Boolean) ? values.join("") : null;
}

export async function writeOfflineValue(key: string, value: string): Promise<void> {
  const previous = await SecureStore.getItemAsync(`${key}.meta`);
  const previousChunks = previous ? Number((JSON.parse(previous) as { chunks?: number }).chunks ?? 0) : 0;
  const chunks = Math.ceil(value.length / chunkSize);
  await Promise.all(Array.from({ length: chunks }, (_, index) => SecureStore.setItemAsync(`${key}.${index}`, value.slice(index * chunkSize, (index + 1) * chunkSize))));
  await SecureStore.setItemAsync(`${key}.meta`, JSON.stringify({ chunks }));
  await Promise.all(Array.from({ length: previousChunks }, (_, index) => index >= chunks ? SecureStore.deleteItemAsync(`${key}.${index}`) : Promise.resolve()));
}

export async function deleteOfflineValue(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(`${key}.meta`);
  const chunks = meta ? Number((JSON.parse(meta) as { chunks?: number }).chunks ?? 0) : 0;
  await Promise.all([
    SecureStore.deleteItemAsync(`${key}.meta`),
    ...Array.from({ length: chunks }, (_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)),
  ]);
}

