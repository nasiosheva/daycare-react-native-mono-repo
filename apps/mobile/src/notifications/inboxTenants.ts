import type { CurrentUser } from "@daycare/core";
import type { AppNotification } from "@daycare/api-client";
import { hasOperationalTenantSubscription } from "../auth/tenantSubscription";

export type InboxTenant = { organizationId: string; organizationName: string };
export type NotificationWithTenant = AppNotification & InboxTenant;

// In a Parent context the inbox spans every PARENT membership (active or not — the inbox is
// read-only) whose tenant subscription is operational; the server rejects the rest anyway
// (docs/business-rules.md §8, §13.12). Every other role keeps reading only the active tenant.
export function inboxTenants(profile: CurrentUser | null | undefined, activeOrganizationId: string | null | undefined): InboxTenant[] {
  const memberships = profile?.memberships ?? [];
  const activeMembership = memberships.find((membership) => membership.organizationId === activeOrganizationId);
  if (!activeMembership) {
    return memberships
      .filter((membership) => membership.role === "PARENT" && hasOperationalTenantSubscription(membership.subscriptionStatus))
      .map((membership) => ({ organizationId: membership.organizationId, organizationName: membership.organizationName }));
  }
  if (activeMembership.role !== "PARENT") return [{ organizationId: activeMembership.organizationId, organizationName: activeMembership.organizationName }];
  return memberships
    .filter((membership) => membership.role === "PARENT" && hasOperationalTenantSubscription(membership.subscriptionStatus))
    .map((membership) => ({ organizationId: membership.organizationId, organizationName: membership.organizationName }));
}

export function mergeInboxNotifications(results: readonly { tenant: InboxTenant; notifications: readonly AppNotification[] | undefined }[]): NotificationWithTenant[] {
  return results
    .flatMap(({ tenant, notifications }) => (notifications ?? []).map((notification) => ({ ...notification, ...tenant })))
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}
