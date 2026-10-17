import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttendanceAction, AttendanceMethod, TenantSubscriptionStatus } from "@daycare/core";
import type { Child, ChildListFilter, CreatePickupExceptionRequestInput } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { hasOperationalTenantSubscription } from "@/auth/tenantSubscription";
import { useAcrossTenants } from "@/tenants/acrossTenants";

export function useChildren(filterOrEnabled: ChildListFilter | boolean = {}, enabled = true) {
  const { api, organizationId } = useAuth();
  const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled;
  const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled;
  return useQuery({ queryKey: ["children", organizationId, filter], queryFn: () => api.children(filter), enabled: Boolean(organizationId) && queryEnabled });
}

export type ChildWithTenant = Child & { organizationName: string; tenantSubscriptionRestricted: boolean };

export function useParentChildrenAcrossTenants(memberships: readonly { organizationId: string; organizationName: string; subscriptionStatus?: TenantSubscriptionStatus | null }[], enabled: boolean) {
  const { api } = useAuth();
  const aggregate = useAcrossTenants({
    tenants: memberships,
    queryKey: (membership) => ["children", membership.organizationId, {}],
    // A restricted tenant's own child list stays readable through the server's explicit
    // allowlist exception (see docs/business-rules.md §13.12 TENANT_SUBSCRIPTION_RESTRICTED) —
    // every other tenant-scoped query keeps excluding these tenants as before.
    queryFn: (membership) => api.children({}, membership.organizationId),
    enabled,
  });
  const data: ChildWithTenant[] = aggregate.results.flatMap(({ tenant, data: children }) => (children ?? []).map((child) => ({ ...child, organizationName: tenant.organizationName, tenantSubscriptionRestricted: !hasOperationalTenantSubscription(tenant.subscriptionStatus) })));
  return { data, isFetching: aggregate.isFetching, failedTenants: aggregate.failedTenants, allFailed: aggregate.allFailed, retryFailed: aggregate.retryFailed };
}

function createIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attendance-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useRecordAttendance() {
  const { api, organizationId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, action, method, qrToken, at, pickupAuthorizationId, pickupExceptionRequestId }: { childId: string; action: AttendanceAction; method: AttendanceMethod; qrToken?: string; at?: string; pickupAuthorizationId?: string; pickupExceptionRequestId?: string }) => api.recordAttendance(childId, { action, method, idempotencyKey: createIdempotencyKey(), qrToken, at, pickupAuthorizationId, pickupExceptionRequestId }),
    onSuccess: async (_attendance, { childId, pickupExceptionRequestId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["children", organizationId] }),
        ...(pickupExceptionRequestId ? [queryClient.invalidateQueries({ queryKey: ["pickup-exception-requests", organizationId, childId] })] : []),
      ]);
    },
  });
}

export function usePickupExceptionRequests(childId: string | null, enabled: boolean) {
  const { api, organizationId } = useAuth();
  return useQuery({
    queryKey: ["pickup-exception-requests", organizationId, childId],
    queryFn: () => api.pickupExceptionRequests(childId!),
    enabled: Boolean(organizationId && childId && enabled),
    refetchInterval: (query) => query.state.data?.some((request) => request.status === "PENDING" || (request.status === "APPROVED" && Boolean(request.approvalExpiresAt) && new Date(request.approvalExpiresAt!).getTime() > Date.now())) ? 5_000 : false,
  });
}

export function useCreatePickupExceptionRequest() {
  const { api, organizationId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, input }: { childId: string; input: CreatePickupExceptionRequestInput }) => api.createPickupExceptionRequest(childId, input),
    onSuccess: async (_request, { childId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pickup-exception-requests", organizationId, childId] }),
        queryClient.invalidateQueries({ queryKey: ["pickup-exception-approvals", organizationId] }),
      ]);
    },
  });
}

export function useAttendanceQr(childId: string, organizationId?: string) {
  const { api, organizationId: activeOrganizationId } = useAuth();
  const resolvedOrganizationId = organizationId ?? activeOrganizationId;
  return useQuery({ queryKey: ["attendance-qr", resolvedOrganizationId, childId], queryFn: () => api.issueAttendanceQr(childId, resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId && childId), staleTime: 30_000 });
}
