import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { hasOrganizationMembership, requiresOrganizationSelection, selectedOrganizationId } from "./organizationContext";

const profile = (organizationIds: string[], isPlatformAdmin = false, role: "PARENT" | "STAFF" = "PARENT"): CurrentUser => ({
  id: "user",
  displayName: "User",
  gender: "UNSPECIFIED",
  isPlatformAdmin,
  memberships: organizationIds.map((organizationId) => ({
    organizationId,
    organizationName: organizationId,
    role,
    active: true,
    canManageChildPrograms: false,
    canManageDevelopmentCategories: false,
    institutionTypes: ["DAYCARE"],
    capabilities: ["DAYCARE_OPERATIONS"],
  })),
});

describe("organization context selection", () => {
  it("uses the only membership but never selects a platform organization", () => {
    expect(selectedOrganizationId(profile(["tenant-a"]), null)).toBe("tenant-a");
    expect(selectedOrganizationId(profile(["tenant-a"], true), "tenant-a")).toBeNull();
  });

  it("auto-selects the first tenant for a Parent with multiple memberships (Home shows all of them at once)", () => {
    const multipleParentMemberships = profile(["tenant-a", "tenant-b"]);
    const autoSelected = selectedOrganizationId(multipleParentMemberships, null);

    expect(autoSelected).toBe("tenant-a");
    expect(requiresOrganizationSelection(multipleParentMemberships, autoSelected)).toBe(false);
    expect(selectedOrganizationId(multipleParentMemberships, "tenant-b")).toBe("tenant-b");
    expect(requiresOrganizationSelection(multipleParentMemberships, "tenant-b")).toBe(false);
  });

  it("requires an explicit choice for multiple non-Parent memberships unless the current choice remains valid", () => {
    const multipleStaffMemberships = profile(["tenant-a", "tenant-b"], false, "STAFF");

    expect(selectedOrganizationId(multipleStaffMemberships, null)).toBeNull();
    expect(requiresOrganizationSelection(multipleStaffMemberships, null)).toBe(true);
    expect(selectedOrganizationId(multipleStaffMemberships, "tenant-b")).toBe("tenant-b");
    expect(requiresOrganizationSelection(multipleStaffMemberships, "tenant-b")).toBe(false);
  });

  it("rejects a tenant that is absent from the current profile", () => {
    const currentProfile = profile(["tenant-a"]);

    expect(hasOrganizationMembership(currentProfile, "tenant-a")).toBe(true);
    expect(hasOrganizationMembership(currentProfile, "tenant-b")).toBe(false);
  });
});
