// Mories Deo Hutapea,S.E.,S.Kom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadOutbox, loadSnapshot, offlineScopeKey, purgeOfflineScope, saveOutbox, saveSnapshot } from "./store";
import type { ChildCareLogOutboxTask, OfflineScope, OfflineSnapshot } from "./types";

const fakeStore = new Map<string, string>();

vi.mock("./persistence", () => ({
  readOfflineValue: vi.fn(async (key: string) => fakeStore.get(key) ?? null),
  writeOfflineValue: vi.fn(async (key: string, value: string) => { fakeStore.set(key, value); }),
  deleteOfflineValue: vi.fn(async (key: string) => { fakeStore.delete(key); }),
}));

const scope: OfflineScope = { userId: "user a/b", organizationId: "tenant-1", role: "STAFF" };

describe("offline store", () => {
  beforeEach(() => fakeStore.clear());

  it("builds a URL-safe scope key from the user, organization, and role", () => {
    expect(offlineScopeKey(scope)).toBe("daycare.offline.user%20a%2Fb.tenant-1.STAFF");
  });

  it("returns an empty outbox when nothing was ever saved", async () => {
    expect(await loadOutbox(scope)).toEqual([]);
  });

  it("round-trips the outbox task list", async () => {
    const task: ChildCareLogOutboxTask = { id: "task-1", kind: "CHILD_CARE_LOG_CREATE", scope, childId: "child-1", payload: { type: "MEAL", occurredAt: "2026-10-11T00:00:00.000Z", mealType: "LUNCH", mealAmount: "ALL" }, createdAt: "2026-10-11T00:00:00.000Z", status: "READY_TO_SYNC", attempts: 0 };

    await saveOutbox(scope, [task]);

    expect(await loadOutbox(scope)).toEqual([task]);
  });

  it("deletes the stored outbox instead of writing an empty array", async () => {
    await saveOutbox(scope, [{ id: "task-1", kind: "CHILD_CARE_LOG_CREATE", scope, childId: "child-1", payload: { type: "MEAL", occurredAt: "2026-10-11T00:00:00.000Z", mealType: "LUNCH", mealAmount: "ALL" }, createdAt: "2026-10-11T00:00:00.000Z", status: "READY_TO_SYNC", attempts: 0 }]);

    await saveOutbox(scope, []);

    expect(fakeStore.has("daycare.offline.user%20a%2Fb.tenant-1.STAFF.outbox")).toBe(false);
    expect(await loadOutbox(scope)).toEqual([]);
  });

  it("returns an empty outbox instead of throwing when the stored value is corrupted", async () => {
    fakeStore.set("daycare.offline.user%20a%2Fb.tenant-1.STAFF.outbox", "not json");

    expect(await loadOutbox(scope)).toEqual([]);
  });

  it("returns a snapshot that has not expired yet", async () => {
    const snapshot: OfflineSnapshot<{ value: string }> = { savedAt: "2026-10-11T00:00:00.000Z", expiresAt: new Date(Date.now() + 60_000).toISOString(), queryKey: ["key"], data: { value: "fresh" } };
    await saveSnapshot(scope, "cache", snapshot);

    expect(await loadSnapshot(scope, "cache")).toEqual(snapshot);
  });

  it("discards a snapshot that has already expired", async () => {
    const snapshot: OfflineSnapshot<{ value: string }> = { savedAt: "2026-10-11T00:00:00.000Z", expiresAt: new Date(Date.now() - 60_000).toISOString(), queryKey: ["key"], data: { value: "stale" } };
    await saveSnapshot(scope, "cache", snapshot);

    expect(await loadSnapshot(scope, "cache")).toBeNull();
  });

  it("returns null instead of throwing when the stored snapshot is corrupted", async () => {
    fakeStore.set("daycare.offline.user%20a%2Fb.tenant-1.STAFF.snapshot.cache", "not json");

    expect(await loadSnapshot(scope, "cache")).toBeNull();
  });

  it("purges both the outbox and the cache snapshot for a scope", async () => {
    await saveOutbox(scope, [{ id: "task-1", kind: "CHILD_CARE_LOG_CREATE", scope, childId: "child-1", payload: { type: "MEAL", occurredAt: "2026-10-11T00:00:00.000Z", mealType: "LUNCH", mealAmount: "ALL" }, createdAt: "2026-10-11T00:00:00.000Z", status: "READY_TO_SYNC", attempts: 0 }]);
    await saveSnapshot(scope, "cache", { savedAt: "2026-10-11T00:00:00.000Z", expiresAt: new Date(Date.now() + 60_000).toISOString(), queryKey: ["key"], data: {} });

    await purgeOfflineScope(scope);

    expect(await loadOutbox(scope)).toEqual([]);
    expect(await loadSnapshot(scope, "cache")).toBeNull();
  });
});
