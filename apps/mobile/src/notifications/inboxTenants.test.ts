import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { inboxTenants, mergeInboxNotifications } from "./inboxTenants";

type Membership = CurrentUser["memberships"][number];

const membership = (organizationId: string, overrides: Partial<Membership> = {}): Membership => ({
  organizationId,
  organizationName: `Tenant ${organizationId}`,
  role: "PARENT",
  active: true,
  canManageChildPrograms: false,
  canManageDevelopmentCategories: false,
  institutionTypes: ["DAYCARE"],
  capabilities: ["DAYCARE_OPERATIONS"],
  ...overrides,
});

const profile = (memberships: Membership[]): CurrentUser => ({ id: "user", displayName: "User", gender: "UNSPECIFIED", registrationRole: "PARENT", isPlatformAdmin: false, memberships });

describe("inboxTenants", () => {
  it("spans every Parent tenant in a Parent context, including inactive ones, but skips restricted subscriptions and non-Parent roles", () => {
    const user = profile([
      membership("a"),
      membership("b", { active: false }),
      membership("c", { subscriptionStatus: "SUSPENDED" }),
      membership("d", { role: "STAFF" }),
    ]);

    expect(inboxTenants(user, "a").map((tenant) => tenant.organizationId)).toEqual(["a", "b"]);
  });

  it("keeps Staff and Staff Admin on the active tenant only", () => {
    const user = profile([membership("a", { role: "STAFF" }), membership("b")]);

    expect(inboxTenants(user, "a")).toEqual([{ organizationId: "a", organizationName: "Tenant a" }]);
  });

  it("still loads operational Parent tenants when no active tenant context is selected", () => {
    expect(inboxTenants(profile([membership("a"), membership("b", { active: false })]), null).map((tenant) => tenant.organizationId)).toEqual(["a", "b"]);
    expect(inboxTenants(null, "a")).toEqual([]);
  });
});

describe("mergeInboxNotifications", () => {
  it("tags every notification with its own tenant and orders the merged inbox newest first", () => {
    const merged = mergeInboxNotifications([
      { tenant: { organizationId: "a", organizationName: "A" }, notifications: [{ id: "a1", title: "A1", body: "", createdAt: "2026-10-01T08:00:00Z" }] },
      { tenant: { organizationId: "b", organizationName: "B" }, notifications: [{ id: "b1", title: "B1", body: "", createdAt: "2026-10-01T09:00:00Z" }] },
      { tenant: { organizationId: "c", organizationName: "C" }, notifications: undefined },
    ]);

    expect(merged.map((item) => [item.id, item.organizationId])).toEqual([["b1", "b"], ["a1", "a"]]);
  });
});
