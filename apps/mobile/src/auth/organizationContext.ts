import type { CurrentUser } from "@daycare/core";

export function selectedOrganizationId(profile: CurrentUser, currentOrganizationId: string | null): string | null {
  if (profile.isPlatformAdmin) return null;
  const memberships = profile.memberships;
  if (memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0].organizationId;
  return currentOrganizationId && memberships.some((membership) => membership.organizationId === currentOrganizationId)
    ? currentOrganizationId
    : null;
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
