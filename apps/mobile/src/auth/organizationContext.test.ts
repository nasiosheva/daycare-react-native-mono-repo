import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { hasOrganizationMembership, requiresOrganizationSelection, selectedOrganizationId } from "./organizationContext";

const profile = (organizationIds: string[], isPlatformAdmin = false): CurrentUser => ({
  id: "user",
  displayName: "User",
  gender: "UNSPECIFIED",
  isPlatformAdmin,
  memberships: organizationIds.map((organizationId) => ({
    organizationId,
    organizationName: organizationId,
    role: "PARENT",
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

  it("requires an explicit choice for multiple memberships unless the current choice remains valid", () => {
    const multipleMemberships = profile(["tenant-a", "tenant-b"]);

    expect(selectedOrganizationId(multipleMemberships, null)).toBeNull();
    expect(requiresOrganizationSelection(multipleMemberships, null)).toBe(true);
    expect(selectedOrganizationId(multipleMemberships, "tenant-b")).toBe("tenant-b");
    expect(requiresOrganizationSelection(multipleMemberships, "tenant-b")).toBe(false);
  });

  it("rejects a tenant that is absent from the current profile", () => {
    const currentProfile = profile(["tenant-a"]);

    expect(hasOrganizationMembership(currentProfile, "tenant-a")).toBe(true);
    expect(hasOrganizationMembership(currentProfile, "tenant-b")).toBe(false);
  });
});
