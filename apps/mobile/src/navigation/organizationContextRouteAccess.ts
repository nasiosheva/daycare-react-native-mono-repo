import type { CurrentUser } from "@daycare/core";
import { requiresOrganizationSelection } from "../auth/organizationContext";
import { parentSelfServicePaths, parentUnscopedReadOnlyPaths } from "./parentSelfServiceRouteAccess";

const unscopedPaths = new Set([
  "/home",
  "/profile",
  "/context-selection",
  ...parentSelfServicePaths,
  ...parentUnscopedReadOnlyPaths,
]);

export function shouldRedirectToOrganizationSelection(profile: CurrentUser | null, organizationId: string | null, pathname: string): boolean {
  return requiresOrganizationSelection(profile, organizationId) && !unscopedPaths.has(pathname);
}

export function shouldBlockNoMembershipRoute(profile: CurrentUser | null, pathname: string): boolean {
  return Boolean(profile && !profile.isPlatformAdmin && profile.memberships.length === 0 && !unscopedPaths.has(pathname));
}
