// Mories Deo Hutapea,S.E.,S.Kom
import { tenantSubscriptionStatusAttentionGroup, type TenantSubscriptionAttentionGroup, type TenantSubscriptionStatus } from "@daycare/core";

export function attentionGroupCount(statusCounts: Partial<Record<TenantSubscriptionStatus, number>>, group: TenantSubscriptionAttentionGroup): number {
  return (Object.keys(statusCounts) as TenantSubscriptionStatus[])
    .filter((status) => tenantSubscriptionStatusAttentionGroup[status] === group)
    .reduce((total, status) => total + (statusCounts[status] ?? 0), 0);
}
