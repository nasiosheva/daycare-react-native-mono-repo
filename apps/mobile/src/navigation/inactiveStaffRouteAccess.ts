import type { CurrentUser } from "@daycare/core";

type Membership = CurrentUser["memberships"][number];

const inactiveStaffAllowedPaths = new Set(["/home", "/profile", "/context-selection"]);

export function isInactiveStaffMembership(membership: Membership | undefined): membership is Membership & { active: false; role: "STAFF" | "STAFF_ADMIN" } {
  return membership?.active === false && (membership.role === "STAFF" || membership.role === "STAFF_ADMIN");
}

export function shouldBlockInactiveStaffRoute(profile: CurrentUser | null, organizationId: string | null, pathname: string): boolean {
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  return isInactiveStaffMembership(membership) && !inactiveStaffAllowedPaths.has(pathname);
}
