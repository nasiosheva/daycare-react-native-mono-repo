import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { isInactiveStaffMembership, shouldBlockInactiveStaffRoute } from "./inactiveStaffRouteAccess";

const profile = (role: "STAFF" | "STAFF_ADMIN", active: boolean): CurrentUser => ({
  id: "user",
  displayName: "User",
  gender: "UNSPECIFIED",
  isPlatformAdmin: false,
  memberships: [{
    organizationId: "tenant-a",
    organizationName: "Tenant A",
    role,
    active,
    canManageChildPrograms: false,
    canManageDevelopmentCategories: false,
    institutionTypes: ["DAYCARE"],
    capabilities: ["DAYCARE_OPERATIONS"],
  }],
});

describe("inactive Staff route access", () => {
  it("keeps inactive Staff and Staff Admin on the safe Home/Profile/context-selection routes", () => {
    const inactiveStaff = profile("STAFF", false);

    expect(isInactiveStaffMembership(inactiveStaff.memberships[0])).toBe(true);
    expect(shouldBlockInactiveStaffRoute(inactiveStaff, "tenant-a", "/home")).toBe(false);
    expect(shouldBlockInactiveStaffRoute(inactiveStaff, "tenant-a", "/profile")).toBe(false);
    expect(shouldBlockInactiveStaffRoute(inactiveStaff, "tenant-a", "/context-selection")).toBe(false);
  });

  it("blocks inactive operational staff routes before their screens load", () => {
    const inactiveStaffAdmin = profile("STAFF_ADMIN", false);

    expect(shouldBlockInactiveStaffRoute(inactiveStaffAdmin, "tenant-a", "/staff-admin")).toBe(true);
    expect(shouldBlockInactiveStaffRoute(inactiveStaffAdmin, "tenant-a", "/academic")).toBe(true);
    expect(shouldBlockInactiveStaffRoute(profile("STAFF", true), "tenant-a", "/staff-operations")).toBe(false);
  });
});
