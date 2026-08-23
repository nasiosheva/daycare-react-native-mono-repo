import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PurchaseServiceInput } from "@daycare/core";
import type { BranchListFilter, Invoice, ServicePlan } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";

export function useServicePlans() { const { api, organizationId } = useAuth(); return useQuery({ queryKey: ["service-plans", organizationId], queryFn: () => api.servicePlans(), enabled: Boolean(organizationId) }); }
export function useEntitlements(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true) { const { api, organizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; return useQuery({ queryKey: ["entitlements", organizationId, filter], queryFn: () => api.entitlements(filter), enabled: Boolean(organizationId) && queryEnabled }); }
export function useBookings(pendingOnly = false, filterOrEnabled: BranchListFilter | boolean = {}, enabled = true) { const { api, organizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; return useQuery({ queryKey: ["bookings", organizationId, pendingOnly, filter], queryFn: () => pendingOnly ? api.pendingBookings(filter) : api.bookings(filter), enabled: Boolean(organizationId) && queryEnabled }); }
export function useInvoices(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true) { const { api, organizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; return useQuery({ queryKey: ["invoices", organizationId, filter], queryFn: () => api.invoices(filter), enabled: Boolean(organizationId) && queryEnabled }); }

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

function useBookingMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const { organizationId } = useAuth(); const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => { void client.invalidateQueries({ queryKey: ["bookings", organizationId] }); void client.invalidateQueries({ queryKey: ["entitlements", organizationId] }); void client.invalidateQueries({ queryKey: ["invoices", organizationId] }); } });
}

export function usePurchaseService() { const { api } = useAuth(); return useBookingMutation<PurchaseServiceInput>((input) => api.purchaseService(input)); }
export function useBookEntitlement() { const { api } = useAuth(); return useBookingMutation<{ entitlementId: string; bookingDates: string[] }>(({ entitlementId, bookingDates }) => api.bookEntitlement(entitlementId, bookingDates)); }
export function useBookingApproval() { const { api } = useAuth(); return useBookingMutation<{ bookingId: string; approved: boolean }>(({ bookingId, approved }) => api.approveBooking(bookingId, approved)); }
export function useMarkInvoicePaid() { const { api } = useAuth(); return useBookingMutation<string>((invoiceId) => api.markInvoicePaid(invoiceId)); }
export function useCreateServicePlan() { const { api } = useAuth(); return useBookingMutation<Omit<ServicePlan, "id">>((input) => api.createServicePlan(input)); }
