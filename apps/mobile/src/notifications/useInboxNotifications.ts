import { useAuth } from "@/auth/AuthProvider";
import { useAcrossTenants } from "@/tenants/acrossTenants";
import { inboxTenants, mergeInboxNotifications } from "./inboxTenants";

// One single-tenant query per inbox tenant, keyed by that tenant's organizationId, so realtime and
// mark-read invalidation of ["notifications", organizationId] keep working per tenant. A failing
// tenant is reported in failedTenants instead of hiding the other tenants' notifications.
export function useInboxNotifications(search = "", enabled = true) {
  const { api, profile, organizationId } = useAuth();
  const tenants = inboxTenants(profile, organizationId);
  const aggregate = useAcrossTenants({
    tenants,
    queryKey: (tenant) => ["notifications", tenant.organizationId, search],
    queryFn: (tenant) => api.notifications(search || undefined, tenant.organizationId),
    enabled,
  });
  return {
    data: mergeInboxNotifications(aggregate.results.map(({ tenant, data }) => ({ tenant, notifications: data }))),
    failedTenants: aggregate.failedTenants,
    allFailed: aggregate.allFailed,
    isFetching: aggregate.isFetching,
    showsTenantLabel: tenants.length > 1,
    retryFailed: aggregate.retryFailed,
  };
}
