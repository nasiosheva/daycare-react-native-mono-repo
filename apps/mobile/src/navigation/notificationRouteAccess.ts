import type { CurrentUser, Role } from "@daycare/core";

type NotificationRoutePolicy = {
  roles?: readonly Role[];
  requireActiveMembership?: boolean;
  requireDaycareCapability?: boolean;
  requiresParentRegistration?: boolean;
  // The screen resolves its tenant from an organizationId route param (per-action tenant
  // resolution, docs/business-rules.md §1), so the param is appended when opening it.
  passesOrganizationId?: boolean;
  // The screen already aggregates across every Parent tenant and picks the tenant per child itself.
  resolvesTenantInScreen?: boolean;
};

const notificationRoutePolicies: Record<string, NotificationRoutePolicy> = {
  "/parent-enrollment": { requiresParentRegistration: true },
  "/parent-payment": { requiresParentRegistration: true, passesOrganizationId: true },
  "/payment-proof": { requiresParentRegistration: true, passesOrganizationId: true },
  "/booking": { roles: ["PARENT"], requireActiveMembership: true, requireDaycareCapability: true, resolvesTenantInScreen: true },
  "/parent-qr": { roles: ["PARENT"], requireActiveMembership: true, requireDaycareCapability: true, resolvesTenantInScreen: true },
  "/attendance-scan": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true, requireDaycareCapability: true },
  "/attendance": { roles: ["STAFF"], requireActiveMembership: true },
  "/booking-approvals": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true, requireDaycareCapability: true },
  "/parent-payments": { roles: ["STAFF_ADMIN"], requireActiveMembership: true },
  "/private-tutoring": { roles: ["PARENT"], requireActiveMembership: true, resolvesTenantInScreen: true },
  "/private-tutoring-admin": { roles: ["STAFF_ADMIN"], requireActiveMembership: true },
  "/staff-operations": { roles: ["STAFF"], requireActiveMembership: true },
  "/staff-leave-approvals": { roles: ["STAFF_ADMIN"], requireActiveMembership: true },
  "/staff-leave-requests": { roles: ["STAFF"], requireActiveMembership: true },
  "/goals": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/absence-requests": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true, passesOrganizationId: true },
  "/incident-reports": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true, passesOrganizationId: true },
  "/children": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/development": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true, passesOrganizationId: true },
  "/parent-child-profile": { roles: ["PARENT"], requireActiveMembership: true, passesOrganizationId: true },
  "/child-detail": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/child-health": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true, passesOrganizationId: true },
  "/child-messages": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true, passesOrganizationId: true },
};

function notificationPath(actionPath: string): string {
  return actionPath.split("?", 1)[0];
}

function policyForNotificationRoute(actionPath: string): NotificationRoutePolicy | undefined {
  return notificationRoutePolicies[notificationPath(actionPath)];
}

export function isSelfServiceNotificationRoute(actionPath: string): boolean {
  return Boolean(policyForNotificationRoute(actionPath)?.requiresParentRegistration);
}

export function notificationRouteRequiresDaycareCapability(actionPath: string): boolean {
  return Boolean(policyForNotificationRoute(actionPath)?.requireDaycareCapability);
}

export function notificationRouteWithOrganizationId(actionPath: string, organizationId: string | null): string {
  if (!organizationId || !policyForNotificationRoute(actionPath)?.passesOrganizationId) return actionPath;
  const [path, query = ""] = actionPath.split("?", 2);
  const parameters = query.split("&").filter((parameter) => parameter && !parameter.startsWith("organizationId="));
  parameters.push(`organizationId=${encodeURIComponent(organizationId)}`);
  return `${path}?${parameters.join("&")}`;
}

// organizationId is the notification's own tenant. Pass activeOrganizationId when that tenant may
// differ from the active one (the cross-tenant Parent inbox): such a route only opens if its screen
// supports per-action tenant resolution, otherwise it would silently render the active tenant.
export function canOpenNotificationRoute(profile: CurrentUser | null, organizationId: string | null, actionPath: string, hasDaycareOffering = false, activeOrganizationId?: string | null): boolean {
  if (!profile || !actionPath.startsWith("/")) return false;
  if (notificationPath(actionPath) === "/home") return true;

  const policy = policyForNotificationRoute(actionPath);
  if (!policy) return false;
  if (policy.requiresParentRegistration) return profile.registrationRole === "PARENT";
  if (!organizationId || !policy.roles) return false;
  if (activeOrganizationId !== undefined && organizationId !== activeOrganizationId && !policy.passesOrganizationId && !policy.resolvesTenantInScreen) return false;

  const membership = profile.memberships.find((item) => item.organizationId === organizationId);
  if (!membership || !policy.roles.includes(membership.role)) return false;
  if (policy.requireActiveMembership && !membership.active) return false;
  return !policy.requireDaycareCapability || policy.resolvesTenantInScreen || hasDaycareOffering;
}
