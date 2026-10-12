// Mories Deo Hutapea,S.E.,S.Kom

import type { CreateChildCareLogInput } from "@daycare/api-client";

export type OfflineStatus = "ONLINE" | "OFFLINE" | "SYNCING" | "CONFLICT" | "STALE";
export type OfflineRole = "STAFF" | "STAFF_ADMIN" | "PARENT";

export type OfflineScope = {
  userId: string;
  organizationId: string;
  role: OfflineRole;
};

export type ChildCareLogOutboxTask = {
  id: string;
  kind: "CHILD_CARE_LOG_CREATE";
  scope: OfflineScope;
  childId: string;
  payload: CreateChildCareLogInput;
  createdAt: string;
  status: "READY_TO_SYNC" | "SYNCING" | "CONFLICT" | "REJECTED";
  attempts: number;
  lastError?: string;
};

export type OfflineSnapshot<T = unknown> = {
  savedAt: string;
  expiresAt: string;
  queryKey: readonly unknown[];
  data: T;
};

