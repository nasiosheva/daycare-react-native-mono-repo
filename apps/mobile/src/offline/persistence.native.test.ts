// Mories Deo Hutapea,S.E.,S.Kom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOfflineValue, readOfflineValue, writeOfflineValue } from "./persistence.native";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { store.delete(key); }),
}));

describe("offline persistence (native, chunked SecureStore)", () => {
  beforeEach(() => store.clear());

  it("round-trips a value smaller than one chunk", async () => {
    await writeOfflineValue("daycare.offline.a", "short value");

    expect(await readOfflineValue("daycare.offline.a")).toBe("short value");
    expect(store.get("daycare.offline.a.meta")).toBe(JSON.stringify({ chunks: 1 }));
  });

  it("round-trips a value spanning multiple chunks", async () => {
    const value = "x".repeat(1_800 * 2 + 500);

    await writeOfflineValue("daycare.offline.b", value);

    expect(store.get("daycare.offline.b.meta")).toBe(JSON.stringify({ chunks: 3 }));
    expect(await readOfflineValue("daycare.offline.b")).toBe(value);
  });

  it("deletes leftover chunks when a later write needs fewer chunks than before", async () => {
    await writeOfflineValue("daycare.offline.c", "x".repeat(1_800 * 3));
    expect(store.has("daycare.offline.c.2")).toBe(true);

    await writeOfflineValue("daycare.offline.c", "short");

    expect(store.get("daycare.offline.c.meta")).toBe(JSON.stringify({ chunks: 1 }));
    expect(store.has("daycare.offline.c.1")).toBe(false);
    expect(store.has("daycare.offline.c.2")).toBe(false);
  });

  it("deletes the meta key and every chunk", async () => {
    await writeOfflineValue("daycare.offline.d", "x".repeat(1_800 * 2));

    await deleteOfflineValue("daycare.offline.d");

    expect(store.size).toBe(0);
  });

  it("returns null when nothing was ever written for the key", async () => {
    expect(await readOfflineValue("daycare.offline.missing")).toBeNull();
  });

  it("returns null when a chunk referenced by meta is missing", async () => {
    await writeOfflineValue("daycare.offline.e", "x".repeat(1_800 * 2));
    store.delete("daycare.offline.e.1");

    expect(await readOfflineValue("daycare.offline.e")).toBeNull();
  });
});
