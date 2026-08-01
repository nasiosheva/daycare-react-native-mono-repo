import type { CurrentUser } from "@daycare/core";
import { parentSelfServicePaths, parentUnscopedReadOnlyPaths } from "./parentSelfServiceRouteAccess";

type Membership = CurrentUser["memberships"][number];

const inactiveParentAllowedPaths = new Set([
  "/home",
  "/profile",
  "/context-selection",
  ...parentSelfServicePaths,
  ...parentUnscopedReadOnlyPaths,
]);

export function isInactiveParentMembership(membership: Membership | undefined): membership is Membership & { active: false; role: "PARENT" } {
  return membership?.active === false && membership.role === "PARENT";
}

export function shouldBlockInactiveParentRoute(profile: CurrentUser | null, organizationId: string | null, pathname: string): boolean {
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  return isInactiveParentMembership(membership) && !inactiveParentAllowedPaths.has(pathname);
}
