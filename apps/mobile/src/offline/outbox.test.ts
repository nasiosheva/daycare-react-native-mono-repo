// Mories Deo Hutapea,S.E.,S.Kom

import { describe, expect, it } from "vitest";
import { createChildCareLogTask, isRetryableOutboxError, pendingOutboxCount } from "./outbox";

describe("offline outbox", () => {
  const scope = { userId: "user-a", organizationId: "tenant-a", role: "STAFF" as const };
  const payload = { type: "MEAL" as const, occurredAt: "2026-10-11T00:00:00.000Z", mealType: "LUNCH" as const, mealAmount: "ALL" as const };

  it("creates a scoped idempotent care-log task", () => {
    const task = createChildCareLogTask(scope, "child-a", payload, new Date("2026-10-11T00:00:00.000Z"));
    expect(task.scope).toEqual(scope);
    expect(task.payload.clientMutationId).toBe(task.id);
    expect(task.status).toBe("READY_TO_SYNC");
  });

  it("does not count rejected tasks as pending", () => {
    const task = createChildCareLogTask(scope, "child-a", payload);
    expect(pendingOutboxCount([{ ...task, status: "REJECTED" }, task])).toBe(1);
  });

  it("retries only transient or unknown outcomes", () => {
    expect(isRetryableOutboxError(undefined)).toBe(true);
    expect(isRetryableOutboxError(503)).toBe(true);
    expect(isRetryableOutboxError(409)).toBe(false);
    expect(isRetryableOutboxError(400)).toBe(false);
  });
});

