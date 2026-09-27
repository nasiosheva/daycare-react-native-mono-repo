import type { TenantSubscriptionStatus } from "@daycare/core";

/**
 * A missing status is treated as operational for compatibility with older
 * profile responses. New responses always include the tenant status.
 */
export function hasOperationalTenantSubscription(status: TenantSubscriptionStatus | null | undefined): boolean {
  return status == null || status === "ACTIVE" || status === "TRIAL";
}
