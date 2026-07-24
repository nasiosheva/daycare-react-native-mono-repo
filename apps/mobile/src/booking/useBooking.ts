import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PurchaseServiceInput } from "@daycare/core";
import type { BranchListFilter, ServicePlan } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";

export function useServicePlans() { const { api, organizationId } = useAuth(); return useQuery({ queryKey: ["service-plans", organizationId], queryFn: () => api.servicePlans(), enabled: Boolean(organizationId) }); }
export function useEntitlements(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true) { const { api, organizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; return useQuery({ queryKey: ["entitlements", organizationId, filter], queryFn: () => api.entitlements(filter), enabled: Boolean(organizationId) && queryEnabled }); }
export function useBookings(pendingOnly = false, filterOrEnabled: BranchListFilter | boolean = {}, enabled = true) { const { api, organizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; return useQuery({ queryKey: ["bookings", organizationId, pendingOnly, filter], queryFn: () => pendingOnly ? api.pendingBookings(filter) : api.bookings(filter), enabled: Boolean(organizationId) && queryEnabled }); }
export function useInvoices(filterOrEnabled: BranchListFilter | boolean = {}, enabled = true) { const { api, organizationId } = useAuth(); const filter = typeof filterOrEnabled === "boolean" ? {} : filterOrEnabled; const queryEnabled = typeof filterOrEnabled === "boolean" ? filterOrEnabled : enabled; return useQuery({ queryKey: ["invoices", organizationId, filter], queryFn: () => api.invoices(filter), enabled: Boolean(organizationId) && queryEnabled }); }

function useBookingMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const { organizationId } = useAuth(); const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => { void client.invalidateQueries({ queryKey: ["bookings", organizationId] }); void client.invalidateQueries({ queryKey: ["entitlements", organizationId] }); void client.invalidateQueries({ queryKey: ["invoices", organizationId] }); } });
}

export function usePurchaseService() { const { api } = useAuth(); return useBookingMutation<PurchaseServiceInput>((input) => api.purchaseService(input)); }
export function useBookEntitlement() { const { api } = useAuth(); return useBookingMutation<{ entitlementId: string; bookingDates: string[] }>(({ entitlementId, bookingDates }) => api.bookEntitlement(entitlementId, bookingDates)); }
export function useBookingApproval() { const { api } = useAuth(); return useBookingMutation<{ bookingId: string; approved: boolean }>(({ bookingId, approved }) => api.approveBooking(bookingId, approved)); }
export function useMarkInvoicePaid() { const { api } = useAuth(); return useBookingMutation<string>((invoiceId) => api.markInvoicePaid(invoiceId)); }
export function useCreateServicePlan() { const { api } = useAuth(); return useBookingMutation<Omit<ServicePlan, "id">>((input) => api.createServicePlan(input)); }
