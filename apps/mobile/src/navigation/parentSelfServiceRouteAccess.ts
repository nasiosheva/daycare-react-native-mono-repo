import type { CurrentUser } from "@daycare/core";

export const parentSelfServicePaths = new Set([
  "/parent-family-profile",
  "/parent-enrollment",
  "/parent-enrollment-form",
  "/parent-payment",
  "/payment-proof",
]);

export const parentUnscopedReadOnlyPaths = new Set(["/operational-hours"]);

export function isParentSelfServiceRoute(pathname: string): boolean {
  return parentSelfServicePaths.has(pathname);
}

export function shouldBlockParentSelfServiceRoute(profile: CurrentUser | null, pathname: string): boolean {
  return Boolean(profile && isParentSelfServiceRoute(pathname) && profile.registrationRole !== "PARENT");
}
