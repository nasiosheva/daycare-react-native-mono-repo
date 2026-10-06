import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";

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
