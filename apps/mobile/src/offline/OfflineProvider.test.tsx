// Mories Deo Hutapea,S.E.,S.Kom
import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNetworkError, ApiTimeoutError } from "@daycare/api-client";
import { OfflineProvider, cacheDescriptor, sanitizeParentProfile, useOffline } from "./OfflineProvider";
import type { OfflineScope } from "./types";

const mocks = vi.hoisted(() => ({
  platformOS: "web",
  auth: {
    api: { createChildCareLog: vi.fn() },
    profile: { id: "user-1", memberships: [{ organizationId: "tenant-1", role: "STAFF" }] } as { id: string; memberships: { organizationId: string; role: string }[] } | null,
    organizationId: "tenant-1" as string | null,
  },
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryCache: vi.fn(),
  },
  cacheSubscriber: undefined as ((event: unknown) => void) | undefined,
  networkSubscriber: undefined as ((online: boolean) => void) | undefined,
  deviceStateListener: undefined as ((state: { type?: string; isConnected: boolean | null }) => void) | undefined,
  appStateListener: undefined as ((state: string) => void) | undefined,
  appStateRemove: vi.fn(),
  addWindowListener: vi.fn(),
  removeWindowListener: vi.fn(),
  loadOutbox: vi.fn(),
  loadSnapshot: vi.fn(),
  saveOutbox: vi.fn(),
  saveSnapshot: vi.fn(),
  purgeOfflineScope: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => mocks.queryClient }));
vi.mock("react-native", () => ({
  Platform: { get OS() { return mocks.platformOS; } },
  AppState: { addEventListener: vi.fn((_event: string, listener: (state: string) => void) => {
    mocks.appStateListener = listener;
    return { remove: mocks.appStateRemove };
  }) },
}));
vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => mocks.auth }));
vi.mock("expo-network", () => ({
  NetworkStateType: { NONE: "NONE", UNKNOWN: "UNKNOWN" },
  getNetworkStateAsync: vi.fn().mockResolvedValue({ type: "WIFI", isConnected: true }),
  addNetworkStateListener: (listener: (state: { type?: string; isConnected: boolean | null }) => void) => {
    mocks.deviceStateListener = listener;
    return { remove: () => { mocks.deviceStateListener = undefined; } };
  },
}));
vi.mock("./networkSignal", () => ({
  markApiAvailable: vi.fn(),
  markApiUnavailable: vi.fn(),
  subscribeApiReachability: (listener: (available: boolean) => void) => {
    mocks.networkSubscriber = listener;
    return () => { mocks.networkSubscriber = undefined; };
  },
}));
vi.mock("./store", () => ({
  loadOutbox: mocks.loadOutbox,
  loadSnapshot: mocks.loadSnapshot,
  offlineScopeKey: (scope: OfflineScope) => `${scope.userId}:${scope.organizationId}:${scope.role}`,
  purgeOfflineScope: mocks.purgeOfflineScope,
  saveOutbox: mocks.saveOutbox,
  saveSnapshot: mocks.saveSnapshot,
}));
vi.mock("./OfflineStatusBanner", () => ({ OfflineStatusBanner: () => null }));

const payload = { type: "MEAL" as const, occurredAt: "2026-10-13T00:00:00.000Z", mealType: "LUNCH" as const, mealAmount: "ALL" as const };
const mounted = new Set<ReturnType<typeof create>>();
let currentOffline: ReturnType<typeof useOffline> | null = null;

function OfflineValueCapture() {
  currentOffline = useOffline();
  return null;
}

function renderOfflineProvider() {
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(<OfflineProvider><OfflineValueCapture /></OfflineProvider>); });
  mounted.add(renderer);
  return {
    update: () => act(() => renderer.update(<OfflineProvider><OfflineValueCapture /></OfflineProvider>)),
    unmount: () => {
      mounted.delete(renderer);
      act(() => renderer.unmount());
    },
  };
}

async function flushEffects() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

function offlineValue() {
  if (!currentOffline) throw new Error("OfflineProvider did not render its context value");
  return currentOffline;
}

function staffScope(role = "STAFF") {
  mocks.auth = {
    api: { createChildCareLog: vi.fn() },
    profile: { id: "user-1", memberships: [{ organizationId: "tenant-1", role }] },
    organizationId: "tenant-1",
  };
  return mocks.auth;
}

describe("OfflineProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("addEventListener", mocks.addWindowListener);
    vi.stubGlobal("removeEventListener", mocks.removeWindowListener);
    mocks.platformOS = "web";
    mocks.cacheSubscriber = undefined;
    mocks.networkSubscriber = undefined;
    mocks.deviceStateListener = undefined;
    mocks.appStateListener = undefined;
    mocks.queryClient.getQueryCache.mockImplementation(() => ({
      subscribe: (listener: (event: unknown) => void) => {
        mocks.cacheSubscriber = listener;
        return vi.fn();
      },
    }));
    mocks.loadOutbox.mockResolvedValue([]);
    mocks.loadSnapshot.mockResolvedValue(null);
    mocks.saveOutbox.mockResolvedValue(undefined);
    mocks.saveSnapshot.mockResolvedValue(undefined);
    mocks.purgeOfflineScope.mockResolvedValue(undefined);
    mocks.auth.api.createChildCareLog.mockResolvedValue({ id: "log-1" });
    staffScope();
    currentOffline = null;
  });

  afterEach(() => {
    for (const renderer of mounted) act(() => renderer.unmount());
    mounted.clear();
    vi.unstubAllGlobals();
  });

  it("builds only tenant-matching cache descriptors and sanitizes Parent snapshots", () => {
    const care = cacheDescriptor(["child-care-logs", "tenant-1", "child-1", "branch-1"], "STAFF", "tenant-1", undefined);
    expect(care?.key).toBe("care:branch-1:child-1");
    expect(care?.sanitize("not-an-array")).toEqual([]);
    expect(care?.sanitize([{ id: "log-1" }])).toEqual([{ id: "log-1" }]);
    expect(cacheDescriptor(["child-care-logs", "tenant-2", "child-1", "branch-1"], "STAFF", "tenant-1", undefined)).toBeNull();
    expect(cacheDescriptor(["child-care-logs", "tenant-1", "child-1", "branch-1"], "PARENT", "tenant-1", undefined)).toBeNull();
    expect(cacheDescriptor(["parent-child-profile", "tenant-1", "child-1"], "PARENT", "tenant-1", {})).toBeNull();
    const parentProfile = { child: { id: "child-1" }, branch: { id: "branch-1" }, programs: [], staffAssignments: [{ id: "staff-1" }] };
    expect(cacheDescriptor(["parent-child-profile", "tenant-1", "child-1"], "PARENT", "tenant-1", parentProfile)?.sanitize(parentProfile)).toMatchObject({ branch: parentProfile.branch, staffAssignments: [] });
    expect(cacheDescriptor(["unknown", "tenant-1"], "STAFF", "tenant-1", undefined)).toBeNull();

    const profile = { child: { id: "child-1" }, branch: { id: "branch-1" }, programs: ["program-1"], staffAssignments: [{ id: "staff-1" }] };
    expect(sanitizeParentProfile(null)).toBeNull();
    expect(sanitizeParentProfile("not-an-object")).toBeNull();
    expect(sanitizeParentProfile(profile)).toEqual({ child: profile.child, branch: profile.branch, placement: null, programs: profile.programs, staffAssignments: [] });
  });

  it("queues and syncs staff care logs, then invalidates only the matching child's query", async () => {
    const rendered = renderOfflineProvider();
    await flushEffects();

    let result: { task: { id: string }; synced: boolean } | undefined;
    await act(async () => { result = await offlineValue().enqueueChildCareLog("child-1", payload); });

    expect(result?.synced).toBe(true);
    expect(result?.task.id).toBeTruthy();
    expect(mocks.auth.api.createChildCareLog).toHaveBeenCalledWith("child-1", expect.objectContaining({ ...payload, clientMutationId: result?.task.id }), "tenant-1");
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["child-care-logs", "tenant-1", "child-1"] });
    expect(offlineValue()).toMatchObject({ status: "ONLINE", isOffline: false, pendingCount: 0 });
    rendered.unmount();
  });

  it("reports API unavailability without claiming the device is offline, then flushes after API recovery", async () => {
    mocks.auth.api.createChildCareLog.mockRejectedValueOnce(new ApiNetworkError()).mockResolvedValueOnce({ id: "log-2" });
    const rendered = renderOfflineProvider();
    await flushEffects();

    let result: { synced: boolean } | undefined;
    await act(async () => { result = await offlineValue().enqueueChildCareLog("child-1", payload); });
    expect(result?.synced).toBe(false);
    expect(offlineValue()).toMatchObject({ status: "API_UNAVAILABLE", isOffline: false, pendingCount: 1 });

    await act(async () => mocks.networkSubscriber?.(true));
    await flushEffects();

    expect(mocks.auth.api.createChildCareLog).toHaveBeenCalledTimes(2);
    expect(offlineValue()).toMatchObject({ status: "ONLINE", pendingCount: 0 });
    rendered.unmount();
  });

  it("does not submit the same queued mutation twice when recovery signals overlap", async () => {
    const scope: OfflineScope = { userId: "user-1", organizationId: "tenant-1", role: "STAFF" };
    const clientMutationId = "offline-mutation-1";
    mocks.loadOutbox.mockResolvedValueOnce([{
      id: clientMutationId,
      kind: "CHILD_CARE_LOG_CREATE",
      scope,
      childId: "child-1",
      payload: { ...payload, clientMutationId },
      createdAt: "2026-10-17T00:00:00.000Z",
      status: "READY_TO_SYNC",
      attempts: 0,
    }]);

    let completeRequest!: (response: { id: string }) => void;
    mocks.auth.api.createChildCareLog.mockImplementationOnce(() => new Promise((resolve) => {
      completeRequest = resolve;
    }));

    const rendered = renderOfflineProvider();
    await flushEffects();
    expect(mocks.auth.api.createChildCareLog).toHaveBeenCalledOnce();
    expect(mocks.auth.api.createChildCareLog).toHaveBeenCalledWith(
      "child-1",
      expect.objectContaining({ clientMutationId }),
      "tenant-1",
    );

    await act(async () => {
      mocks.networkSubscriber?.(true);
      mocks.deviceStateListener?.({ type: "WIFI", isConnected: true });
      mocks.appStateListener?.("active");
      await Promise.resolve();
    });

    expect(mocks.auth.api.createChildCareLog).toHaveBeenCalledOnce();

    await act(async () => completeRequest({ id: "log-1" }));
    await flushEffects();

    expect(mocks.auth.api.createChildCareLog).toHaveBeenCalledOnce();
    expect(offlineValue()).toMatchObject({ status: "ONLINE", pendingCount: 0 });
    rendered.unmount();
  });

  it("reports offline only when the device connectivity provider confirms disconnection", async () => {
    const rendered = renderOfflineProvider();
    await flushEffects();

    await act(async () => mocks.deviceStateListener?.({ type: "NONE", isConnected: false }));

    expect(offlineValue()).toMatchObject({ status: "OFFLINE", isOffline: true });
    rendered.unmount();
  });

  it("keeps API timeouts distinct from device disconnection and permits Staff Admin care-log capture", async () => {
    staffScope("STAFF_ADMIN");
    mocks.auth.api.createChildCareLog.mockRejectedValueOnce(new ApiTimeoutError()).mockResolvedValueOnce({ id: "log-3" });
    const rendered = renderOfflineProvider();
    await flushEffects();

    await act(async () => {
      const result = await offlineValue().enqueueChildCareLog("child-3", payload);
      expect(result.synced).toBe(false);
    });
    expect(offlineValue()).toMatchObject({ status: "API_UNAVAILABLE", isOffline: false, pendingCount: 1 });

    await act(async () => mocks.networkSubscriber?.(true));
    await flushEffects();
    expect(offlineValue()).toMatchObject({ status: "ONLINE", pendingCount: 0 });
    expect(mocks.auth.api.createChildCareLog).toHaveBeenCalledTimes(2);
    rendered.unmount();
  });

  it("marks rejected tasks stale and conflicts visible without silently discarding them", async () => {
    mocks.auth.api.createChildCareLog.mockRejectedValueOnce(new ApiError(400, "VALIDATION_ERROR", "Invalid"));
    const rejectedProvider = renderOfflineProvider();
    await flushEffects();
    await act(async () => { await offlineValue().enqueueChildCareLog("child-1", payload); });
    expect(offlineValue()).toMatchObject({ status: "STALE", pendingCount: 0 });
    rejectedProvider.unmount();

    staffScope();
    mocks.auth.api.createChildCareLog.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Already recorded"));
    const conflictProvider = renderOfflineProvider();
    await flushEffects();
    await act(async () => { await offlineValue().enqueueChildCareLog("child-2", payload); });
    expect(offlineValue()).toMatchObject({ status: "CONFLICT", pendingCount: 1 });
    conflictProvider.unmount();
  });

  it("refuses Parent mutations while keeping their offline scope read-only", async () => {
    staffScope("PARENT");
    const rendered = renderOfflineProvider();
    await flushEffects();

    await expect(offlineValue().enqueueChildCareLog("child-1", payload)).rejects.toThrow("offline.staff_only");
    await act(async () => offlineValue().flush());
    expect(mocks.auth.api.createChildCareLog).not.toHaveBeenCalled();
    expect(offlineValue()).toMatchObject({ status: "ONLINE", pendingCount: 0 });
    rendered.unmount();
  });

  it("restores scoped snapshots and persists sanitized query updates", async () => {
    const scope: OfflineScope = { userId: "user-1", organizationId: "tenant-1", role: "STAFF" };
    const queryKey = ["child-care-logs", "tenant-1", "child-1", "branch-1"];
    mocks.loadSnapshot.mockResolvedValue({ data: { cacheEntry: { queryKey, data: "invalid", savedAt: "2026-10-12T00:00:00.000Z", expiresAt: "2026-10-20T00:00:00.000Z" } } });
    const rendered = renderOfflineProvider();
    await flushEffects();

    expect(mocks.queryClient.setQueryData).toHaveBeenCalledWith(queryKey, "invalid");
    await act(async () => mocks.cacheSubscriber?.({ type: "updated", query: { queryKey, state: { status: "success", data: "invalid" } } }));
    await act(async () => mocks.cacheSubscriber?.({ type: "added", query: { queryKey, state: { status: "success", data: "ignored" } } }));
    await act(async () => mocks.cacheSubscriber?.({ type: "updated", query: { queryKey, state: { status: "pending", data: "ignored" } } }));
    await flushEffects();

    expect(mocks.saveSnapshot).toHaveBeenCalledWith(scope, "cache", expect.objectContaining({
      queryKey: ["offline-cache"],
      data: expect.objectContaining({ "care:branch-1:child-1": expect.objectContaining({ queryKey, data: [] }) }),
    }));
    rendered.unmount();
  });

  it("drops outbox/snapshot state for a prior tenant when auth scope changes", async () => {
    const previousScope: OfflineScope = { userId: "user-1", organizationId: "tenant-1", role: "STAFF" };
    const rendered = renderOfflineProvider();
    await flushEffects();

    mocks.auth = { ...mocks.auth, organizationId: "tenant-2", profile: { id: "user-1", memberships: [{ organizationId: "tenant-2", role: "STAFF" }] } };
    rendered.update();
    await flushEffects();

    expect(mocks.purgeOfflineScope).toHaveBeenCalledWith(previousScope);
    expect(mocks.loadOutbox).toHaveBeenLastCalledWith({ userId: "user-1", organizationId: "tenant-2", role: "STAFF" });
    rendered.unmount();
  });

  it("subscribes to API reachability, device connectivity, and app state", async () => {
    const rendered = renderOfflineProvider();
    await flushEffects();
    expect(mocks.networkSubscriber).toBeTypeOf("function");
    expect(mocks.deviceStateListener).toBeTypeOf("function");
    expect(mocks.appStateListener).toBeTypeOf("function");

    rendered.unmount();

    expect(mocks.appStateRemove).toHaveBeenCalledOnce();
    expect(mocks.networkSubscriber).toBeUndefined();
    expect(mocks.deviceStateListener).toBeUndefined();
  });

  it("keeps an unscoped user online and skips native background sync without pending work", async () => {
    mocks.auth = { api: { createChildCareLog: vi.fn() }, profile: null, organizationId: null };
    mocks.platformOS = "android";
    const rendered = renderOfflineProvider();
    await flushEffects();

    expect(offlineValue()).toMatchObject({ status: "ONLINE", pendingCount: 0 });
    await expect(offlineValue().enqueueChildCareLog("child-1", payload)).rejects.toThrow("offline.staff_only");
    await act(async () => mocks.appStateListener?.("active"));
    expect(mocks.loadOutbox).not.toHaveBeenCalled();
    expect(mocks.auth.api.createChildCareLog).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
