import { useQueries } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { inboxTenants, mergeInboxNotifications } from "./inboxTenants";

// One single-tenant query per inbox tenant, keyed by that tenant's organizationId, so realtime and
// mark-read invalidation of ["notifications", organizationId] keep working per tenant. A failing
// tenant is reported in failedTenants instead of hiding the other tenants' notifications.
export function useInboxNotifications(search = "", enabled = true) {
  const { api, profile, organizationId } = useAuth();
  const tenants = inboxTenants(profile, organizationId);
  const queries = useQueries({
    queries: tenants.map((tenant) => ({
      queryKey: ["notifications", tenant.organizationId, search],
      queryFn: () => api.notifications(search || undefined, tenant.organizationId),
      enabled,
    })),
  });
  const data = mergeInboxNotifications(queries.map((query, index) => ({ tenant: tenants[index], notifications: query.data })));
  const failedTenants = tenants.filter((_, index) => queries[index].isError);
  const retryFailed = () => queries.forEach((query) => { if (query.isError) void query.refetch(); });
  return {
    data,
    failedTenants,
    allFailed: tenants.length > 0 && failedTenants.length === tenants.length,
    isFetching: queries.some((query) => query.isFetching),
    showsTenantLabel: tenants.length > 1,
    retryFailed,
  };
}
