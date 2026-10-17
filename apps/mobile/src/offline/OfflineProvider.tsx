// Mories Deo Hutapea,S.E.,S.Kom

import { AppState } from "react-native";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { ApiError, isApiNetworkError, isApiTimeoutError, type CreateChildCareLogInput, type ParentChildProfile } from "@daycare/api-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { subscribeDeviceConnectivity } from "./deviceConnectivity";
import { subscribeApiReachability } from "./networkSignal";
import { createChildCareLogTask, isRetryableOutboxError, pendingOutboxCount } from "./outbox";
import { loadOutbox, loadSnapshot, offlineScopeKey, purgeOfflineScope, saveOutbox, saveSnapshot } from "./store";
import type { ChildCareLogOutboxTask, OfflineRole, OfflineScope, OfflineStatus } from "./types";
import { OfflineStatusBanner } from "./OfflineStatusBanner";

type SnapshotBundle = Record<string, { queryKey: QueryKey; data: unknown; savedAt: string; expiresAt: string }>;
type OfflineContextValue = {
  status: OfflineStatus;
  isOffline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  enqueueChildCareLog: (childId: string, input: CreateChildCareLogInput) => Promise<{ task: ChildCareLogOutboxTask; synced: boolean }>;
  flush: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { api, profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const role: OfflineRole | null = membership?.role === "STAFF" || membership?.role === "STAFF_ADMIN" || membership?.role === "PARENT" ? membership.role : null;
  const scope = useMemo<OfflineScope | null>(() => profile?.id && organizationId && role ? { userId: profile.id, organizationId, role } : null, [organizationId, profile?.id, role]);
  const scopeKey = scope ? offlineScopeKey(scope) : null;
  const [online, setOnline] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [tasks, setTasks] = useState<ChildCareLogOutboxTask[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const tasksRef = useRef(tasks);
  const scopeRef = useRef<OfflineScope | null>(scope);
  const onlineRef = useRef(online);
  const syncingRef = useRef(syncing);
  const previousScopeRef = useRef<OfflineScope | null>(null);
  const bundlesRef = useRef<SnapshotBundle>({});
  const restoringRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  tasksRef.current = tasks;
  scopeRef.current = scope;
  onlineRef.current = online;
  syncingRef.current = syncing;

  const persistTasks = useCallback(async (next: ChildCareLogOutboxTask[]) => {
    const currentScope = scopeRef.current;
    if (!currentScope) return;
    tasksRef.current = next;
    setTasks(next);
    await saveOutbox(currentScope, next);
  }, []);

  const flush = useCallback(async () => {
    // Refs, not the online/syncing state variables: this can run synchronously right after
    // setOnline()/setApiAvailable() in the same event, before React has re-rendered and
    // rebuilt this closure with the new value, which would otherwise make the guard below act on
    // a stale "offline"/"syncing" snapshot and silently skip the retry.
    const currentScope = scopeRef.current;
    if (!currentScope || currentScope.role === "PARENT" || !onlineRef.current || syncingRef.current) return;
    const pending = tasksRef.current.filter((task) => task.status === "READY_TO_SYNC" || task.status === "CONFLICT");
    if (!pending.length) return;
    syncingRef.current = true;
    setSyncing(true);
    setConflict(false);
    let remaining = [...tasksRef.current];
    try {
      for (const task of pending) {
        remaining = remaining.map((item) => item.id === task.id ? { ...item, status: "SYNCING", attempts: item.attempts + 1 } : item);
        await persistTasks(remaining);
        try {
          await api.createChildCareLog(task.childId, task.payload, currentScope.organizationId);
          remaining = remaining.filter((item) => item.id !== task.id);
          await persistTasks(remaining);
          void queryClient.invalidateQueries({ queryKey: ["child-care-logs", currentScope.organizationId, task.childId] });
          setLastSyncAt(new Date().toISOString());
        } catch (error) {
          const status = error instanceof ApiError ? error.status : undefined;
          if (isApiNetworkError(error) || isApiTimeoutError(error) || isRetryableOutboxError(status)) {
            remaining = remaining.map((item) => item.id === task.id ? { ...item, status: "READY_TO_SYNC", lastError: error instanceof Error ? error.message : "network" } : item);
            await persistTasks(remaining);
            setApiAvailable(false);
            break;
          }
          remaining = remaining.map((item) => item.id === task.id ? { ...item, status: status === 409 ? "CONFLICT" : "REJECTED", lastError: error instanceof Error ? error.message : "sync_failed" } : item);
          await persistTasks(remaining);
          if (status === 409) setConflict(true);
        }
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [api, persistTasks, queryClient]);
  flushRef.current = flush;

  const enqueueChildCareLog = useCallback(async (childId: string, input: CreateChildCareLogInput) => {
    const currentScope = scopeRef.current;
    if (!currentScope || (currentScope.role !== "STAFF" && currentScope.role !== "STAFF_ADMIN")) throw new Error("offline.staff_only");
    const task = createChildCareLogTask(currentScope, childId, input);
    await persistTasks([...tasksRef.current, task]);
    await flush();
    const synced = !tasksRef.current.some((item) => item.id === task.id);
    return { task, synced };
  }, [flush, persistTasks]);

  useEffect(() => {
    // flushRef (not flush itself) so this subscribes once instead of re-subscribing every time
    // flush's identity changes, which happens mid-flush as `syncing`/`online` toggle.
    const unsubscribeApi = subscribeApiReachability((available) => {
      setApiAvailable(available);
      if (available) void flushRef.current();
    });
    const unsubscribeDevice = subscribeDeviceConnectivity((connected) => {
      onlineRef.current = connected;
      setOnline(connected);
      if (connected) void flushRef.current();
    });
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") void flushRef.current(); });
    return () => {
      unsubscribeApi();
      unsubscribeDevice();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const previous = previousScopeRef.current;
    previousScopeRef.current = scope;
    if (!scope) {
      setTasks([]);
      setLastSyncAt(null);
      if (previous) void purgeOfflineScope(previous);
      return;
    }
    if (previous && offlineScopeKey(previous) !== scopeKey) void purgeOfflineScope(previous);
    void Promise.all([
      loadOutbox(scope),
      loadSnapshot<SnapshotBundle>(scope, "cache"),
    ]).then(([storedTasks, storedSnapshot]) => {
      if (!active) return;
      setTasks(storedTasks);
      tasksRef.current = storedTasks;
      bundlesRef.current = storedSnapshot?.data ?? {};
      restoringRef.current = true;
      Object.values(bundlesRef.current).forEach((entry) => queryClient.setQueryData(entry.queryKey, entry.data));
      restoringRef.current = false;
      void flushRef.current();
    });
    return () => { active = false; };
    // flushRef (not flush) so this restoration only re-runs when the scope itself changes, not
    // every time flush's identity changes mid-flush as `syncing`/`online` toggle — otherwise it
    // would re-read the (stale, pre-write) persisted outbox and stomp on an in-flight sync.
  }, [queryClient, scope, scopeKey]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (restoringRef.current || !scope || event.type !== "updated" || event.query.state.status !== "success") return;
      const descriptor = cacheDescriptor(event.query.queryKey, scope.role, scope.organizationId, event.query.state.data);
      if (!descriptor) return;
      const data = descriptor.sanitize(event.query.state.data);
      const now = new Date();
      const next = {
        ...bundlesRef.current,
        [descriptor.key]: { queryKey: event.query.queryKey, data, savedAt: now.toISOString(), expiresAt: new Date(now.getTime() + descriptor.maxAgeMs).toISOString() },
      };
      bundlesRef.current = next;
      void saveSnapshot(scope, "cache", { savedAt: now.toISOString(), expiresAt: new Date(Math.max(...Object.values(next).map((item) => new Date(item.expiresAt).getTime()))).toISOString(), queryKey: ["offline-cache"], data: next });
    });
    return unsubscribe;
  }, [queryClient, scope]);

  const status: OfflineStatus = conflict ? "CONFLICT" : syncing ? "SYNCING" : !online ? "OFFLINE" : !apiAvailable ? "API_UNAVAILABLE" : tasks.some((task) => task.status === "REJECTED") ? "STALE" : "ONLINE";
  const value = useMemo<OfflineContextValue>(() => ({ status, isOffline: status === "OFFLINE", pendingCount: pendingOutboxCount(tasks), lastSyncAt, enqueueChildCareLog, flush }), [enqueueChildCareLog, flush, lastSyncAt, status, tasks]);
  return <OfflineContext.Provider value={value}><OfflineStatusBanner />{children}</OfflineContext.Provider>;
}

export function cacheDescriptor(queryKey: QueryKey, role: OfflineRole, organizationId: string, rawData: unknown): { key: string; maxAgeMs: number; sanitize: (data: unknown) => unknown } | null {
  if (queryKey[1] !== organizationId) return null;
  if ((role === "STAFF" || role === "STAFF_ADMIN") && queryKey[0] === "child-care-logs" && typeof queryKey[2] === "string" && typeof queryKey[3] === "string") {
    const childId = queryKey[2];
    const branchId = queryKey[3];
    return { key: `care:${branchId}:${childId}`, maxAgeMs: 24 * 60 * 60 * 1000, sanitize: (data) => Array.isArray(data) ? data : [] };
  }
  if (role === "PARENT" && queryKey[0] === "parent-child-profile" && typeof queryKey[2] === "string") {
    const childId = queryKey[2];
    const branchId = (rawData as ParentChildProfile | undefined)?.branch?.id;
    if (!branchId) return null;
    return { key: `profile:${branchId}:${childId}`, maxAgeMs: 7 * 24 * 60 * 60 * 1000, sanitize: sanitizeParentProfile };
  }
  return null;
}

export function sanitizeParentProfile(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const profile = data as ParentChildProfile;
  return { child: profile.child, branch: profile.branch, placement: profile.placement ?? null, programs: profile.programs, staffAssignments: [] } satisfies Partial<ParentChildProfile>;
}

export function useOffline(): OfflineContextValue {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("useOffline must be used inside OfflineProvider");
  return value;
}

