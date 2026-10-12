// Mories Deo Hutapea,S.E.,S.Kom

import { afterEach, describe, expect, it } from "vitest";
import { deleteOfflineValue, readOfflineValue, writeOfflineValue } from "./persistence.web";

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
}

describe("offline persistence (web)", () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it("round-trips a value through localStorage", async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage() as unknown as Storage;

    await writeOfflineValue("daycare.offline.a", "value-a");

    expect(await readOfflineValue("daycare.offline.a")).toBe("value-a");
  });

  it("returns null for a key that was never written", async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage() as unknown as Storage;

    expect(await readOfflineValue("daycare.offline.missing")).toBeNull();
  });

  it("removes a value from localStorage", async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage() as unknown as Storage;

    await writeOfflineValue("daycare.offline.b", "value-b");
    await deleteOfflineValue("daycare.offline.b");

    expect(await readOfflineValue("daycare.offline.b")).toBeNull();
  });

  it("does not throw when localStorage is unavailable", async () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;

    await expect(writeOfflineValue("daycare.offline.c", "value-c")).resolves.toBeUndefined();
    await expect(readOfflineValue("daycare.offline.c")).resolves.toBeNull();
    await expect(deleteOfflineValue("daycare.offline.c")).resolves.toBeUndefined();
  });
});
