import { useQueries } from "@tanstack/react-query";
import { NOTIFICATIONS_PAGE_SIZE } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { inboxTenants, mergeInboxNotifications } from "./inboxTenants";

// One single-tenant query per inbox tenant, keyed by that tenant's organizationId, so realtime and
// mark-read invalidation of ["notifications", organizationId] keep working per tenant. A failing
// tenant is reported in failedTenants instead of hiding the other tenants' notifications.
export function useInboxNotifications(search = "", pageOrEnabled: number | boolean = 0, enabled = true) {
  const page = typeof pageOrEnabled === "number" ? pageOrEnabled : 0;
  const queryEnabled = typeof pageOrEnabled === "boolean" ? pageOrEnabled : enabled;
  const { api, profile, organizationId } = useAuth();
  const tenants = inboxTenants(profile, organizationId);
  const pageIndexes = Array.from({ length: page + 1 }, (_, index) => index);
  const queries = useQueries({
    queries: tenants.flatMap((tenant) => pageIndexes.map((pageIndex) => ({
      queryKey: ["notifications", tenant.organizationId, search, pageIndex, NOTIFICATIONS_PAGE_SIZE],
      queryFn: () => api.notifications(search || undefined, tenant.organizationId, pageIndex, NOTIFICATIONS_PAGE_SIZE),
      enabled: queryEnabled,
    }))),
  });

  const tenantResults = tenants.map((tenant, tenantIndex) => {
    const firstQueryIndex = tenantIndex * pageIndexes.length;
    const notifications = pageIndexes.flatMap((_, pageIndex) => queries[firstQueryIndex + pageIndex]?.data?.items ?? []);
    const totalCount = queries[firstQueryIndex]?.data?.totalCount ?? 0;
    const unreadCount = queries[firstQueryIndex]?.data?.unreadCount ?? 0;
    return { tenant, notifications, totalCount, unreadCount };
  });
  const failedTenants = tenants.filter((_, tenantIndex) => pageIndexes.some((_, pageIndex) => queries[tenantIndex * pageIndexes.length + pageIndex]?.isError));
  const initialPageFailedTenants = tenants.filter((_, tenantIndex) => queries[tenantIndex * pageIndexes.length]?.isError);
  const isFetching = queries.some((query) => query.isFetching);
  const merged = mergeInboxNotifications(tenantResults.map(({ tenant, notifications }) => ({ tenant, notifications })));
  const data = merged.slice(page * NOTIFICATIONS_PAGE_SIZE, (page + 1) * NOTIFICATIONS_PAGE_SIZE);
  const hasNext = tenants.some((_, tenantIndex) => queries[tenantIndex * pageIndexes.length + pageIndexes.length - 1]?.data?.hasNext === true);
  const retryFailed = () => queries.forEach((query) => { if (query.isError) void query.refetch(); });
  return {
    data,
    tenants,
    failedTenants,
    allFailed: tenants.length > 0 && initialPageFailedTenants.length === tenants.length,
    isFetching,
    totalCount: tenantResults.reduce((sum, result) => sum + result.totalCount, 0),
    unreadCount: tenantResults.reduce((sum, result) => sum + result.unreadCount, 0),
    hasNext,
    showsTenantLabel: tenants.length > 1,
    retryFailed,
  };
}
