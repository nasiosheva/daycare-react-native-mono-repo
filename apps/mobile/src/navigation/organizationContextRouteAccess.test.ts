import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { shouldBlockNoMembershipRoute, shouldRedirectToOrganizationSelection } from "./organizationContextRouteAccess";

const profile: CurrentUser = {
  id: "parent",
  displayName: "Parent",
  gender: "UNSPECIFIED",
  registrationRole: "PARENT",
  isPlatformAdmin: false,
  memberships: ["tenant-a", "tenant-b"].map((organizationId) => ({
    organizationId,
    organizationName: organizationId,
    role: "PARENT",
    active: true,
    canManageChildPrograms: false,
    canManageDevelopmentCategories: false,
    institutionTypes: ["DAYCARE"],
    capabilities: ["DAYCARE_OPERATIONS"],
  })),
};

describe("organization context route access", () => {
  it("requires a context choice before a tenant-scoped route renders", () => {
    expect(shouldRedirectToOrganizationSelection(profile, null, "/booking")).toBe(true);
    expect(shouldRedirectToOrganizationSelection(profile, null, "/notifications")).toBe(true);
  });

  it("keeps global and Parent self-service routes available before selection", () => {
    expect(shouldRedirectToOrganizationSelection(profile, null, "/profile")).toBe(false);
    expect(shouldRedirectToOrganizationSelection(profile, null, "/parent-enrollment")).toBe(false);
    expect(shouldRedirectToOrganizationSelection(profile, null, "/parent-payment")).toBe(false);
    expect(shouldRedirectToOrganizationSelection(profile, null, "/operational-hours")).toBe(false);
    expect(shouldRedirectToOrganizationSelection(profile, "tenant-b", "/booking")).toBe(false);
  });

  it("blocks a Parent without a membership from a child-scoped route", () => {
    const onboardingParent: CurrentUser = { ...profile, memberships: [] };

    expect(shouldBlockNoMembershipRoute(onboardingParent, "/booking")).toBe(true);
    expect(shouldBlockNoMembershipRoute(onboardingParent, "/parent-enrollment")).toBe(false);
    expect(shouldBlockNoMembershipRoute(onboardingParent, "/operational-hours")).toBe(false);
  });
});
