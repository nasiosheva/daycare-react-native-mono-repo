import type { CurrentUser, Role } from "@daycare/core";

export type LegacyDaycareRoutePolicy = {
  roles: readonly Role[];
  requireActiveMembership: boolean;
  requireDaycareCapability: boolean;
};

export const legacyDaycareRoutePolicies = {
  parentBooking: {
    roles: ["PARENT"],
    requireActiveMembership: true,
    requireDaycareCapability: true,
  },
  parentQr: {
    roles: ["PARENT"],
    requireActiveMembership: true,
    requireDaycareCapability: true,
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
  if (!organizationId) return false;
  const membership = profile.memberships.find((item) => item.organizationId === organizationId);
  if (!membership || !policy.roles.includes(membership.role)) return false;
  if (policy.requireActiveMembership && !membership.active) return false;
  return !policy.requireDaycareCapability || hasDaycareOffering;
}
