import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PurchaseServiceInput, TenantSubscriptionStatus } from "@daycare/core";
import type { BranchListFilter, Invoice, ServicePlan } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { useAcrossTenants } from "@/tenants/acrossTenants";

export function useServicePlans(organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["service-plans", resolvedOrganizationId], queryFn: () => api.servicePlans(resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) }); }
export function useEntitlements(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true, organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["entitlements", resolvedOrganizationId, filter], queryFn: () => api.entitlements(filter, resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) && queryEnabled }); }
export function useBookings(pendingOnly = false, filterOrEnabled: BranchListFilter | boolean = {}, enabled = true, organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["bookings", resolvedOrganizationId, pendingOnly, filter], queryFn: () => pendingOnly ? api.pendingBookings(filter) : api.bookings(filter, resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) && queryEnabled }); }
export function useInvoices(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true, organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["invoices", resolvedOrganizationId, filter], queryFn: () => api.invoices(filter, undefined, resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) && queryEnabled }); }

export type InvoiceWithTenant = Invoice & { organizationId: string; organizationName: string };

type ParentTenant = { organizationId: string; organizationName: string; subscriptionStatus?: TenantSubscriptionStatus | null };

// Invoice self-service is a narrow billing exception: the server can return a Parent's own
// invoices even when membership or tenant subscription is restricted (docs/business-rules.md
// §13.12). Other operational queries continue to filter restricted tenants at their call site.
export function useParentInvoicesAcrossTenants(memberships: readonly ParentTenant[], enabled: boolean) {
  const { api } = useAuth();
  const aggregate = useAcrossTenants({
    tenants: memberships,
    queryKey: (membership) => ["invoices", membership.organizationId, {}],
    queryFn: (membership) => api.invoices({}, undefined, membership.organizationId),
    enabled,
  });
  const data: InvoiceWithTenant[] = aggregate.results.flatMap(({ tenant, data: invoices }) => (invoices ?? []).map((invoice) => ({ ...invoice, organizationId: tenant.organizationId, organizationName: tenant.organizationName })));
  return { data, isFetching: aggregate.isFetching, failedTenants: aggregate.failedTenants, allFailed: aggregate.allFailed, retryFailed: aggregate.retryFailed };
}

// The caller passes only tenants whose published offerings include DAYCARE_OPERATIONS, which the
// entitlements endpoint requires.
export function useParentEntitlementsAcrossTenants(memberships: readonly ParentTenant[], enabled: boolean) {
  const { api } = useAuth();
  const aggregate = useAcrossTenants({
    tenants: memberships,
    queryKey: (membership) => ["entitlements", membership.organizationId, {}],
    queryFn: (membership) => api.entitlements({}, membership.organizationId),
    enabled,
  });
  const data = aggregate.results.flatMap(({ data: entitlements }) => entitlements ?? []);
  return { data, isFetching: aggregate.isFetching, failedTenants: aggregate.failedTenants, retryFailed: aggregate.retryFailed };
}

// A mutation targeting a non-active tenant (organizationId passed explicitly by the caller,
// resolved via resolveOrganizationId) still invalidates the active tenant's own cached lists —
// nothing else on screen assumes a switch happened, so both must refresh independently.
function useBookingMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>, resolveOrganizationId?: (variables: TVariables) => string | undefined) {
  const { organizationId: activeOrganizationId } = useAuth(); const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_, variables) => {
      const targetOrganizationId = resolveOrganizationId?.(variables) ?? activeOrganizationId;
      for (const resource of ["bookings", "entitlements", "invoices"]) void client.invalidateQueries({ queryKey: [resource, targetOrganizationId] });
      if (targetOrganizationId !== activeOrganizationId) for (const resource of ["bookings", "entitlements", "invoices"]) void client.invalidateQueries({ queryKey: [resource, activeOrganizationId] });
    },
  });
}

export function usePurchaseService() { const { api } = useAuth(); return useBookingMutation<PurchaseServiceInput & { organizationId?: string }>(({ organizationId, ...input }) => api.purchaseService(input, organizationId), (variables) => variables.organizationId); }
export function useBookEntitlement() { const { api } = useAuth(); return useBookingMutation<{ entitlementId: string; bookingDates: string[]; organizationId?: string }>(({ entitlementId, bookingDates, organizationId }) => api.bookEntitlement(entitlementId, bookingDates, organizationId), (variables) => variables.organizationId); }
export function useBookingApproval() { const { api } = useAuth(); return useBookingMutation<{ bookingId: string; approved: boolean }>(({ bookingId, approved }) => api.approveBooking(bookingId, approved)); }
export function useMarkInvoicePaid() { const { api } = useAuth(); return useBookingMutation<string>((invoiceId) => api.markInvoicePaid(invoiceId)); }
export function useCreateServicePlan() { const { api } = useAuth(); return useBookingMutation<Omit<ServicePlan, "id">>((input) => api.createServicePlan(input)); }
