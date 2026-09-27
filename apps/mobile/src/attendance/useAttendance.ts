import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttendanceAction, AttendanceMethod, TenantSubscriptionStatus } from "@daycare/core";
import type { Child, ChildListFilter } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { hasOperationalTenantSubscription } from "@/auth/tenantSubscription";

export function useChildren(filterOrEnabled: ChildListFilter | boolean = {}, enabled = true) {
  const { api, organizationId } = useAuth();
  const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled;
  const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled;
  return useQuery({ queryKey: ["children", organizationId, filter], queryFn: () => api.children(filter), enabled: Boolean(organizationId) && queryEnabled });
}

export type ChildWithTenant = Child & { organizationName: string; tenantSubscriptionRestricted: boolean };

export function useParentChildrenAcrossTenants(memberships: readonly { organizationId: string; organizationName: string; subscriptionStatus?: TenantSubscriptionStatus | null }[], enabled: boolean) {
  const { api } = useAuth();
  const queries = useQueries({
    queries: memberships.map((membership) => ({
      queryKey: ["children", membership.organizationId, {}],
      // A restricted tenant's own child list stays readable through the server's explicit
      // allowlist exception (see docs/business-rules.md §13.12 TENANT_SUBSCRIPTION_RESTRICTED) —
      // every other tenant-scoped query keeps excluding these tenants as before.
      queryFn: () => api.children({}, membership.organizationId),
      enabled,
    })),
  });
  const isFetching = queries.some((query) => query.isFetching);
  const isError = queries.some((query) => query.isError);
  const data: ChildWithTenant[] = queries.flatMap((query, index) => (query.data ?? []).map((child) => ({ ...child, organizationName: memberships[index].organizationName, tenantSubscriptionRestricted: !hasOperationalTenantSubscription(memberships[index].subscriptionStatus) })));
  const refetch = () => queries.forEach((query) => void query.refetch());
  return { data, isFetching, isError, refetch };
}

function createIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attendance-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useRecordAttendance() {
  const { api, organizationId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, action, method, qrToken, at, pickupAuthorizationId, pickupExceptionReason }: { childId: string; action: AttendanceAction; method: AttendanceMethod; qrToken?: string; at?: string; pickupAuthorizationId?: string; pickupExceptionReason?: string }) => api.recordAttendance(childId, { action, method, idempotencyKey: createIdempotencyKey(), qrToken, at, pickupAuthorizationId, pickupExceptionReason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children", organizationId] }),
  });
}

export function useAttendanceQr(childId: string) {
  const { api, organizationId } = useAuth();
  return useQuery({ queryKey: ["attendance-qr", organizationId, childId], queryFn: () => api.issueAttendanceQr(childId), enabled: Boolean(organizationId && childId), staleTime: 30_000 });
}
