import { useQueries, type QueryKey } from "@tanstack/react-query";

export type TenantRef = { organizationId: string; organizationName: string };

type TenantQueryState<TData> = { data: TData | undefined; isError: boolean; isFetching: boolean };

// A client-side aggregate of single-tenant queries (docs/business-rules.md §1, §13.2): one failing
// tenant is reported in failedTenants instead of hiding every other tenant's data.
export function summarizeAcrossTenants<TTenant extends TenantRef, TData>(tenants: readonly TTenant[], states: readonly TenantQueryState<TData>[]) {
  const failedTenants = tenants.filter((_, index) => states[index]?.isError);
  return {
    results: tenants.map((tenant, index) => ({ tenant, data: states[index]?.data })),
    failedTenants,
    allFailed: tenants.length > 0 && failedTenants.length === tenants.length,
    isFetching: states.some((state) => state.isFetching),
  };
}

export function useAcrossTenants<TTenant extends TenantRef, TData>({ tenants, queryKey, queryFn, enabled }: { tenants: readonly TTenant[]; queryKey: (tenant: TTenant) => QueryKey; queryFn: (tenant: TTenant) => Promise<TData>; enabled: boolean }) {
  const queries = useQueries({ queries: tenants.map((tenant) => ({ queryKey: queryKey(tenant), queryFn: () => queryFn(tenant), enabled })) });
  const retryFailed = () => queries.forEach((query) => { if (query.isError) void query.refetch(); });
  return { ...summarizeAcrossTenants(tenants, queries), retryFailed };
}
