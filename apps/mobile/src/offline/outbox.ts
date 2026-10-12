// Mories Deo Hutapea,S.E.,S.Kom

import type { CreateChildCareLogInput } from "@daycare/api-client";
import type { ChildCareLogOutboxTask, OfflineScope } from "./types";

export function createChildCareLogTask(scope: OfflineScope, childId: string, payload: CreateChildCareLogInput, now = new Date()): ChildCareLogOutboxTask {
  const id = globalThis.crypto?.randomUUID?.() ?? `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
  return { id, kind: "CHILD_CARE_LOG_CREATE", scope, childId, payload: { ...payload, clientMutationId: id }, createdAt: now.toISOString(), status: "READY_TO_SYNC", attempts: 0 };
}

export function pendingOutboxCount(tasks: readonly ChildCareLogOutboxTask[]): number {
  return tasks.filter((task) => task.status !== "REJECTED").length;
}

export function isRetryableOutboxError(status: number | undefined): boolean {
  return status === undefined || status === 408 || status === 425 || status === 429 || status >= 500;
}

