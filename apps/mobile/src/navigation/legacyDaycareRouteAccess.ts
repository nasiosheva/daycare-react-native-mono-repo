import type { CurrentUser, Role } from "@daycare/core";

export type LegacyDaycareRoutePolicy = {
  roles: readonly Role[];
  requireActiveMembership: boolean;
  requireDaycareCapability: boolean;
  // When true, this route's own content isn't tied to any single active tenant (it aggregates
  // across every membership itself), so access is decided across ALL of the profile's
  // role-matching memberships instead of just the currently active one.
  crossTenant?: boolean;
};

export const legacyDaycareRoutePolicies = {
  parentBooking: {
    roles: ["PARENT"],
    requireActiveMembership: true,
    requireDaycareCapability: true,
    crossTenant: true,
  },
  parentQr: {
    roles: ["PARENT"],
    requireActiveMembership: true,
    requireDaycareCapability: true,
    crossTenant: true,
  },
  attendanceScan: {
    roles: ["STAFF_ADMIN", "STAFF"],
    requireActiveMembership: true,
    requireDaycareCapability: true,
  },
  staffAdminDaycareOperations: {
    roles: ["STAFF_ADMIN"],
    requireActiveMembership: true,
    requireDaycareCapability: true,
  },
  bookingApprovals: {
    roles: ["STAFF_ADMIN", "STAFF"],
    requireActiveMembership: true,
    requireDaycareCapability: true,
  },
} as const satisfies Record<string, LegacyDaycareRoutePolicy>;

export function hasLegacyDaycareRouteAccess(
  profile: CurrentUser,
  organizationId: string | null,
  policy: LegacyDaycareRoutePolicy,
  hasDaycareOffering: boolean,
) {
  if (policy.crossTenant) {
    const hasEligibleMembership = profile.memberships.some((item) => policy.roles.includes(item.role) && (!policy.requireActiveMembership || item.active));
    if (!hasEligibleMembership) return false;
    return !policy.requireDaycareCapability || hasDaycareOffering;
  }
  if (!organizationId) return false;
  const membership = profile.memberships.find((item) => item.organizationId === organizationId);
  if (!membership || !policy.roles.includes(membership.role)) return false;
  if (policy.requireActiveMembership && !membership.active) return false;
  return !policy.requireDaycareCapability || hasDaycareOffering;
}
