import type { CurrentUser, Role } from "@daycare/core";

type NotificationRoutePolicy = {
  roles?: readonly Role[];
  requireActiveMembership?: boolean;
  requireDaycareCapability?: boolean;
  requiresParentRegistration?: boolean;
  passesOrganizationId?: boolean;
};

const notificationRoutePolicies: Record<string, NotificationRoutePolicy> = {
  "/parent-enrollment": { requiresParentRegistration: true },
  "/parent-payment": { requiresParentRegistration: true, passesOrganizationId: true },
  "/payment-proof": { requiresParentRegistration: true, passesOrganizationId: true },
  "/booking": { roles: ["PARENT"], requireActiveMembership: true, requireDaycareCapability: true },
  "/parent-qr": { roles: ["PARENT"], requireActiveMembership: true, requireDaycareCapability: true },
  "/attendance-scan": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true, requireDaycareCapability: true },
  "/attendance": { roles: ["STAFF"], requireActiveMembership: true },
  "/booking-approvals": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true, requireDaycareCapability: true },
  "/parent-payments": { roles: ["STAFF_ADMIN"], requireActiveMembership: true },
  "/private-tutoring": { roles: ["PARENT"], requireActiveMembership: true },
  "/private-tutoring-admin": { roles: ["STAFF_ADMIN"], requireActiveMembership: true },
  "/staff-operations": { roles: ["STAFF"], requireActiveMembership: true },
  "/staff-leave-approvals": { roles: ["STAFF_ADMIN"], requireActiveMembership: true },
  "/staff-leave-requests": { roles: ["STAFF"], requireActiveMembership: true },
  "/goals": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/absence-requests": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/incident-reports": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/children": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/development": { roles: ["PARENT", "STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
  "/parent-child-profile": { roles: ["PARENT"], requireActiveMembership: true },
  "/child-detail": { roles: ["STAFF_ADMIN", "STAFF"], requireActiveMembership: true },
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

export function notificationRouteWithOrganizationId(actionPath: string, organizationId: string | null): string {
  if (!organizationId || !policyForNotificationRoute(actionPath)?.passesOrganizationId) return actionPath;
  const [path, query = ""] = actionPath.split("?", 2);
  const parameters = query.split("&").filter((parameter) => parameter && !parameter.startsWith("organizationId="));
  parameters.push(`organizationId=${encodeURIComponent(organizationId)}`);
  return `${path}?${parameters.join("&")}`;
}

export function canOpenNotificationRoute(profile: CurrentUser | null, organizationId: string | null, actionPath: string, hasDaycareOffering = false): boolean {
  if (!profile || !actionPath.startsWith("/")) return false;
  if (notificationPath(actionPath) === "/home") return true;

  const policy = policyForNotificationRoute(actionPath);
  if (!policy) return false;
  if (policy.requiresParentRegistration) return profile.registrationRole === "PARENT";
  if (!organizationId || !policy.roles) return false;

  const membership = profile.memberships.find((item) => item.organizationId === organizationId);
  if (!membership || !policy.roles.includes(membership.role)) return false;
  if (policy.requireActiveMembership && !membership.active) return false;
  return !policy.requireDaycareCapability || hasDaycareOffering;
}
