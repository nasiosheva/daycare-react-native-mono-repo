import type { CurrentUser } from "@daycare/core";

export function selectedOrganizationId(profile: CurrentUser, currentOrganizationId: string | null): string | null {
  if (profile.isPlatformAdmin) return null;
  const memberships = profile.memberships;
  if (memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0].organizationId;
  if (currentOrganizationId && memberships.some((membership) => membership.organizationId === currentOrganizationId)) {
    return currentOrganizationId;
  }
  // A Parent with children at several tenants sees all of them on Home at once (no explicit
  // tenant choice needed) — default to one so Home can render instead of forcing context-selection.
  if (memberships.every((membership) => membership.role === "PARENT")) {
    return (memberships.find((membership) => membership.active) ?? memberships[0]).organizationId;
  }
  return null;
}

export function hasOrganizationMembership(profile: CurrentUser | null, organizationId: string): boolean {
  return Boolean(profile?.memberships.some((membership) => membership.organizationId === organizationId));
}

export function requiresOrganizationSelection(profile: CurrentUser | null, organizationId: string | null): boolean {
  return Boolean(
    profile
    && !profile.isPlatformAdmin
    && profile.memberships.length > 1
    && !hasOrganizationMembership(profile, organizationId ?? ""),
  );
}
