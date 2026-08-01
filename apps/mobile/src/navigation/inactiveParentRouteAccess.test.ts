import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { isInactiveParentMembership, shouldBlockInactiveParentRoute } from "./inactiveParentRouteAccess";

const profile = (active: boolean): CurrentUser => ({
  id: "parent",
  displayName: "Parent",
  gender: "UNSPECIFIED",
  registrationRole: "PARENT",
  isPlatformAdmin: false,
  memberships: [{
    organizationId: "tenant-a",
    organizationName: "Tenant A",
    role: "PARENT",
    active,
    canManageChildPrograms: false,
    canManageDevelopmentCategories: false,
    institutionTypes: ["DAYCARE"],
    capabilities: ["DAYCARE_OPERATIONS"],
  }],
});

describe("inactive Parent route access", () => {
  it("keeps payer and enrollment self-service available without operational routes", () => {
    const inactiveParent = profile(false);

    expect(isInactiveParentMembership(inactiveParent.memberships[0])).toBe(true);
    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/parent-enrollment")).toBe(false);
    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/parent-payment")).toBe(false);
    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/payment-proof")).toBe(false);
    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/operational-hours")).toBe(false);
    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/profile")).toBe(false);
  });

  it("blocks inactive Parent access to operational child and notification routes", () => {
    const inactiveParent = profile(false);

    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/booking")).toBe(true);
    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/incident-reports")).toBe(true);
    expect(shouldBlockInactiveParentRoute(inactiveParent, "tenant-a", "/notifications")).toBe(true);
    expect(shouldBlockInactiveParentRoute(profile(true), "tenant-a", "/booking")).toBe(false);
  });
});
