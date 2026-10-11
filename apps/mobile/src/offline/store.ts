// Mories Deo Hutapea,S.E.,S.Kom

import { deleteOfflineValue, readOfflineValue, writeOfflineValue } from "./persistence";
import type { ChildCareLogOutboxTask, OfflineScope, OfflineSnapshot } from "./types";

const keyPart = (value: string) => encodeURIComponent(value);
const scopePrefix = (scope: OfflineScope) => `daycare.offline.${keyPart(scope.userId)}.${keyPart(scope.organizationId)}.${scope.role}`;

export function offlineScopeKey(scope: OfflineScope): string {
  return scopePrefix(scope);
}

export async function loadOutbox(scope: OfflineScope): Promise<ChildCareLogOutboxTask[]> {
  const raw = await readOfflineValue(`${scopePrefix(scope)}.outbox`);
  if (!raw) return [];
  try { return JSON.parse(raw) as ChildCareLogOutboxTask[]; } catch { return []; }
}

export async function saveOutbox(scope: OfflineScope, tasks: ChildCareLogOutboxTask[]): Promise<void> {
  if (tasks.length === 0) return deleteOfflineValue(`${scopePrefix(scope)}.outbox`);
  await writeOfflineValue(`${scopePrefix(scope)}.outbox`, JSON.stringify(tasks));
}

export async function loadSnapshot<T>(scope: OfflineScope, snapshotName: string): Promise<OfflineSnapshot<T> | null> {
  const raw = await readOfflineValue(`${scopePrefix(scope)}.snapshot.${keyPart(snapshotName)}`);
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as OfflineSnapshot<T>;
    return new Date(snapshot.expiresAt).getTime() > Date.now() ? snapshot : null;
  } catch { return null; }
}

export async function saveSnapshot<T>(scope: OfflineScope, snapshotName: string, snapshot: OfflineSnapshot<T>): Promise<void> {
  await writeOfflineValue(`${scopePrefix(scope)}.snapshot.${keyPart(snapshotName)}`, JSON.stringify(snapshot));
}

export async function purgeOfflineScope(scope: OfflineScope): Promise<void> {
  await Promise.all([
    deleteOfflineValue(`${scopePrefix(scope)}.outbox`),
    deleteOfflineValue(`${scopePrefix(scope)}.snapshot.cache`),
  ]);
}

