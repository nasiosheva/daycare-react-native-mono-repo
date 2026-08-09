import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { hasLegacyDaycareRouteAccess, legacyDaycareRoutePolicies } from "./legacyDaycareRouteAccess";

const parentProfile: CurrentUser = {
  id: "parent",
  displayName: "Parent",
  gender: "UNSPECIFIED",
  isPlatformAdmin: false,
  memberships: [{
    organizationId: "tenant-daycare",
    organizationName: "Daycare",
    role: "PARENT",
    active: true,
    canManageChildPrograms: false,
    canManageDevelopmentCategories: false,
    institutionTypes: ["DAYCARE"],
    capabilities: ["DAYCARE_OPERATIONS"],
  }],
};

describe("hasLegacyDaycareRouteAccess", () => {
  it("requires an active parent membership and a published Daycare offering for booking and QR", () => {
    expect(hasLegacyDaycareRouteAccess(parentProfile, "tenant-daycare", legacyDaycareRoutePolicies.parentBooking, true)).toBe(true);
    expect(hasLegacyDaycareRouteAccess(parentProfile, "tenant-daycare", legacyDaycareRoutePolicies.parentQr, true)).toBe(true);

    const inactiveProfile: CurrentUser = {
      ...parentProfile,
      memberships: parentProfile.memberships.map((membership) => ({ ...membership, active: false })),
    };
    const noDaycareProfile: CurrentUser = {
      ...parentProfile,
      memberships: parentProfile.memberships.map((membership) => ({ ...membership, capabilities: [] })),
    };

    expect(hasLegacyDaycareRouteAccess(inactiveProfile, "tenant-daycare", legacyDaycareRoutePolicies.parentBooking, true)).toBe(false);
    expect(hasLegacyDaycareRouteAccess(noDaycareProfile, "tenant-daycare", legacyDaycareRoutePolicies.parentQr, false)).toBe(false);
  });

  it("requires an active Staff Admin and a published Daycare offering for legacy financial and booking operations", () => {
    const staffAdminProfile: CurrentUser = {
      ...parentProfile,
      memberships: parentProfile.memberships.map((membership) => ({ ...membership, role: "STAFF_ADMIN" as const })),
    };

    expect(hasLegacyDaycareRouteAccess(staffAdminProfile, "tenant-daycare", legacyDaycareRoutePolicies.staffAdminDaycareOperations, true)).toBe(true);
    expect(hasLegacyDaycareRouteAccess({ ...staffAdminProfile, memberships: staffAdminProfile.memberships.map((membership) => ({ ...membership, capabilities: [] })) }, "tenant-daycare", legacyDaycareRoutePolicies.staffAdminDaycareOperations, false)).toBe(false);
  });

  it("preserves active in-scope Staff access to booking approvals", () => {
    const staffProfile: CurrentUser = {
      ...parentProfile,
      memberships: parentProfile.memberships.map((membership) => ({ ...membership, role: "STAFF" as const })),
    };

    expect(hasLegacyDaycareRouteAccess(staffProfile, "tenant-daycare", legacyDaycareRoutePolicies.bookingApprovals, true)).toBe(true);
  });
});
