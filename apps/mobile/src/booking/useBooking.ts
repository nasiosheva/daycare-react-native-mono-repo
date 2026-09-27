import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PurchaseServiceInput } from "@daycare/core";
import type { BranchListFilter, Invoice, ServicePlan } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";

export function useServicePlans(organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["service-plans", resolvedOrganizationId], queryFn: () => api.servicePlans(resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) }); }
export function useEntitlements(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true, organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["entitlements", resolvedOrganizationId, filter], queryFn: () => api.entitlements(filter, resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) && queryEnabled }); }
export function useBookings(pendingOnly = false, filterOrEnabled: BranchListFilter | boolean = {}, enabled = true, organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["bookings", resolvedOrganizationId, pendingOnly, filter], queryFn: () => pendingOnly ? api.pendingBookings(filter) : api.bookings(filter, resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) && queryEnabled }); }
export function useInvoices(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true, organizationId?: string) { const { api, organizationId: activeOrganizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; const resolvedOrganizationId = organizationId ?? activeOrganizationId; return useQuery({ queryKey: ["invoices", resolvedOrganizationId, filter], queryFn: () => api.invoices(filter, undefined, resolvedOrganizationId ?? undefined), enabled: Boolean(resolvedOrganizationId) && queryEnabled }); }

export type InvoiceWithTenant = Invoice & { organizationId: string; organizationName: string };

export function useParentInvoicesAcrossTenants(memberships: readonly { organizationId: string; organizationName: string }[], enabled: boolean) {
  const { api } = useAuth();
  const queries = useQueries({
    queries: memberships.map((membership) => ({
      queryKey: ["invoices", membership.organizationId, {}],
      queryFn: () => api.invoices({}, undefined, membership.organizationId),
      enabled,
    })),
  });
  const isFetching = queries.some((query) => query.isFetching);
  const isError = queries.some((query) => query.isError);
  const data: InvoiceWithTenant[] = queries.flatMap((query, index) => (query.data ?? []).map((invoice) => ({ ...invoice, organizationId: memberships[index].organizationId, organizationName: memberships[index].organizationName })));
  const refetch = () => queries.forEach((query) => void query.refetch());
  return { data, isFetching, isError, refetch };
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
