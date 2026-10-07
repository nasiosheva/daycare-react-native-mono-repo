import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { useAcrossTenants, type TenantRef } from "@/tenants/acrossTenants";

export const childMessageUnreadSummaryQueryKey = (organizationId?: string | null) => ["child-message-unread-summary", organizationId] as const;

/**
 * Staff/Staff Admin unread chat totals for the active tenant, refreshed by the
 * CHILD_MESSAGES realtime flag. Parents and inactive memberships get zero.
 */
export function useChildMessageUnreadSummary() {
  const { api, profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const enabled = Boolean(organizationId && membership?.active && (membership.role === "STAFF" || membership.role === "STAFF_ADMIN"));
  const summary = useQuery({
    queryKey: childMessageUnreadSummaryQueryKey(organizationId),
    queryFn: () => api.childMessageUnreadSummary(organizationId ?? undefined),
    enabled,
  });
  const unreadByChildId = useMemo(() => new Map((summary.data?.children ?? []).map((item) => [item.childId, item.unreadCount])), [summary.data]);
  return { totalUnreadCount: enabled ? summary.data?.totalUnreadCount ?? 0 : 0, unreadByChildId };
}

/**
 * Parent unread chat counts per child across every given Parent tenant, using
 * the same per-tenant query key as the Staff badge so realtime invalidation
 * refreshes the active tenant; other tenants refresh when Home reloads.
 */
export function useParentChildMessageUnreadAcrossTenants(memberships: readonly TenantRef[]) {
  const { api } = useAuth();
  const summaries = useAcrossTenants({
    tenants: memberships,
    queryKey: (membership) => childMessageUnreadSummaryQueryKey(membership.organizationId),
    queryFn: (membership) => api.childMessageUnreadSummary(membership.organizationId),
    enabled: memberships.length > 0,
  });
  return useMemo(() => new Map(summaries.results.flatMap((result) => (result.data?.children ?? []).map((item) => [item.childId, item.unreadCount] as const))), [summaries.results]);
}
