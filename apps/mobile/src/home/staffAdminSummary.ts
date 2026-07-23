import type { Booking, Invoice, ServiceEntitlement, TenantUser } from "@daycare/api-client";

type StaffAdminSummaryInput = {
  children: readonly unknown[];
  users: readonly TenantUser[];
  pendingBookings: readonly Booking[];
  invoices: readonly Invoice[];
  entitlements: readonly ServiceEntitlement[];
};

export type StaffAdminSummary = {
  activeChildren: number;
  activeStaff: number;
  pendingApprovals: number;
  pendingInvoices: number;
  activeSubscriptions: number;
  remainingCredits: number;
};

export function createStaffAdminSummary({ children, users, pendingBookings, invoices, entitlements }: StaffAdminSummaryInput): StaffAdminSummary {
  const activeEntitlements = entitlements.filter((entitlement) => entitlement.status === "ACTIVE");
  return {
    activeChildren: children.length,
    activeStaff: users.filter((user) => user.status === "ACTIVE" && (user.role === "STAFF_ADMIN" || user.role === "STAFF")).length,
    pendingApprovals: pendingBookings.filter((booking) => booking.status === "PENDING_APPROVAL").length,
    pendingInvoices: invoices.filter((invoice) => invoice.status === "PENDING").length,
    activeSubscriptions: activeEntitlements.length,
    remainingCredits: activeEntitlements.reduce((total, entitlement) => total + (entitlement.remainingCredits ?? 0), 0),
  };
}
