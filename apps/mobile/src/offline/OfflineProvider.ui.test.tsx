// Mories Deo Hutapea,S.E.,S.Kom

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import { ApiError, ApiNetworkError } from "@daycare/api-client";
import { markNetworkOnline } from "./networkSignal";
import { OfflineProvider, cacheDescriptor, sanitizeParentProfile, useOffline } from "./OfflineProvider";

jest.mock("./OfflineStatusBanner", () => ({ OfflineStatusBanner: () => null }));

const mockInvalidateQueries = jest.fn();
const mockSetQueryData = jest.fn();
// A stable object: OfflineProvider's useQueryClient()-dependent effects re-run whenever this
// reference changes, so a fresh object per call (the default React Query behavior does return a
// stable client) would make them re-fire on every render instead of only when the scope changes.
const mockQueryClient = { invalidateQueries: mockInvalidateQueries, getQueryCache: () => ({ subscribe: () => () => {} }), setQueryData: mockSetQueryData };
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => mockQueryClient }));

const mockCreateChildCareLog = jest.fn();
let mockAuthValue: { api: { createChildCareLog: typeof mockCreateChildCareLog }; profile: { id: string; memberships: { organizationId: string; role: string }[] }; organizationId: string };
jest.mock("@/auth/AuthProvider", () => ({ useAuth: () => mockAuthValue }));

const mockLoadOutbox = jest.fn();
const mockSaveOutbox = jest.fn();
jest.mock("./store", () => ({
  offlineScopeKey: (scope: { userId: string; organizationId: string; role: string }) => `${scope.userId}:${scope.organizationId}:${scope.role}`,
  loadOutbox: (...args: unknown[]) => mockLoadOutbox(...args),
  saveOutbox: (...args: unknown[]) => mockSaveOutbox(...args),
  loadSnapshot: jest.fn().mockResolvedValue(null),
  saveSnapshot: jest.fn().mockResolvedValue(undefined),
  purgeOfflineScope: jest.fn().mockResolvedValue(undefined),
}));

describe("cacheDescriptor", () => {
  it("describes a STAFF child-care-log query for the active tenant", () => {
    const descriptor = cacheDescriptor(["child-care-logs", "tenant-1", "child-1", "branch-1"], "STAFF", "tenant-1", undefined);
    expect(descriptor).toMatchObject({ key: "care:branch-1:child-1" });
    expect(descriptor?.sanitize("not-an-array")).toEqual([]);
    expect(descriptor?.sanitize([1, 2])).toEqual([1, 2]);
  });

  it("returns null for a query belonging to a different tenant", () => {
    expect(cacheDescriptor(["child-care-logs", "tenant-2", "child-1", "branch-1"], "STAFF", "tenant-1", undefined)).toBeNull();
  });

  it("describes a PARENT profile query only when the profile has a branch", () => {
    const withBranch = cacheDescriptor(["parent-child-profile", "tenant-1", "child-1"], "PARENT", "tenant-1", { branch: { id: "branch-1" } });
    expect(withBranch).toMatchObject({ key: "profile:branch-1:child-1" });

    expect(cacheDescriptor(["parent-child-profile", "tenant-1", "child-1"], "PARENT", "tenant-1", {})).toBeNull();
  });

  it("returns null for an unrecognized query key", () => {
    expect(cacheDescriptor(["something-else", "tenant-1"], "STAFF", "tenant-1", undefined)).toBeNull();
  });
});

describe("sanitizeParentProfile", () => {
  it("returns null for non-object data", () => {
    expect(sanitizeParentProfile(null)).toBeNull();
    expect(sanitizeParentProfile("not an object")).toBeNull();
  });

  it("keeps child, branch, and programs but drops staff assignments and defaults placement to null", () => {
    const sanitized = sanitizeParentProfile({
      child: { id: "child-1" },
      branch: { id: "branch-1" },
      programs: ["program-1"],
      staffAssignments: [{ id: "staff-1" }],
    });
    expect(sanitized).toEqual({ child: { id: "child-1" }, branch: { id: "branch-1" }, placement: null, programs: ["program-1"], staffAssignments: [] });
  });
});

describe("OfflineProvider enqueueChildCareLog", () => {
  const payload = { type: "MEAL" as const, occurredAt: "2026-10-11T00:00:00.000Z", mealType: "LUNCH" as const, mealAmount: "ALL" as const };

  beforeEach(() => {
    jest.resetAllMocks();
    mockLoadOutbox.mockResolvedValue([]);
    mockSaveOutbox.mockResolvedValue(undefined);
    mockAuthValue = { api: { createChildCareLog: mockCreateChildCareLog }, profile: { id: "user-1", memberships: [{ organizationId: "tenant-1", role: "STAFF" }] }, organizationId: "tenant-1" };
    // jest-expo's default AppState mock doesn't return a subscription object, unlike real React
    // Native, so OfflineProvider's cleanup (`appState.remove()`) would crash on unmount otherwise.
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
  });

  it("syncs immediately and invalidates the child's query when the API call succeeds", async () => {
    mockCreateChildCareLog.mockResolvedValue({ id: "log-1" });
    const { result } = renderHook(() => useOffline(), { wrapper: OfflineProvider });
    await waitFor(() => expect(mockLoadOutbox).toHaveBeenCalled()); // let the mount-time outbox restoration settle first

    let outcome: { synced: boolean } | undefined;
    await act(async () => { outcome = await result.current.enqueueChildCareLog("child-1", payload); });

    expect(outcome?.synced).toBe(true);
    expect(mockCreateChildCareLog).toHaveBeenCalledWith("child-1", expect.objectContaining({ clientMutationId: expect.any(String) }), "tenant-1");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["child-care-logs", "tenant-1", "child-1"] });
    await waitFor(() => expect(result.current.status).toBe("ONLINE"));
    expect(result.current.pendingCount).toBe(0);
  });

  it("keeps the task queued and flips offline on a network error, then recovers once back online", async () => {
    mockCreateChildCareLog.mockRejectedValueOnce(new ApiNetworkError()).mockResolvedValueOnce({ id: "log-1" });
    const { result } = renderHook(() => useOffline(), { wrapper: OfflineProvider });
    await waitFor(() => expect(mockLoadOutbox).toHaveBeenCalled()); // let the mount-time outbox restoration settle first

    let outcome: { synced: boolean } | undefined;
    await act(async () => { outcome = await result.current.enqueueChildCareLog("child-1", payload); });

    expect(outcome?.synced).toBe(false);
    await waitFor(() => expect(result.current.status).toBe("OFFLINE"));
    expect(result.current.pendingCount).toBe(1);

    await act(async () => { markNetworkOnline(); });

    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(mockCreateChildCareLog).toHaveBeenCalledTimes(2);
  });

  it("rejects the task without retrying on a non-retryable API error", async () => {
    mockCreateChildCareLog.mockRejectedValue(new ApiError(400, "invalid", "Invalid payload"));
    const { result } = renderHook(() => useOffline(), { wrapper: OfflineProvider });
    await waitFor(() => expect(mockLoadOutbox).toHaveBeenCalled()); // let the mount-time outbox restoration settle first

    await act(async () => { await result.current.enqueueChildCareLog("child-1", payload); });

    await waitFor(() => expect(result.current.status).toBe("STALE"));
    expect(result.current.pendingCount).toBe(0);
  });

  it("marks a conflicting mutation as CONFLICT instead of discarding it", async () => {
    mockCreateChildCareLog.mockRejectedValue(new ApiError(409, "conflict", "Already recorded"));
    const { result } = renderHook(() => useOffline(), { wrapper: OfflineProvider });
    await waitFor(() => expect(mockLoadOutbox).toHaveBeenCalled()); // let the mount-time outbox restoration settle first

    await act(async () => { await result.current.enqueueChildCareLog("child-1", payload); });

    await waitFor(() => expect(result.current.status).toBe("CONFLICT"));
    expect(result.current.pendingCount).toBe(1);
  });

  it("refuses to enqueue for a Parent membership", async () => {
    mockAuthValue = { api: { createChildCareLog: mockCreateChildCareLog }, profile: { id: "user-1", memberships: [{ organizationId: "tenant-1", role: "PARENT" }] }, organizationId: "tenant-1" };
    const { result } = renderHook(() => useOffline(), { wrapper: OfflineProvider });

    await expect(result.current.enqueueChildCareLog("child-1", payload)).rejects.toThrow("offline.staff_only");
    expect(mockCreateChildCareLog).not.toHaveBeenCalled();
  });
});
