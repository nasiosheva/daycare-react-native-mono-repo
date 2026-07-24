import type { Child, Invoice, ServiceEntitlement } from "@daycare/api-client";

export type ParentChildSummary = { child: Child; activeEntitlements: ServiceEntitlement[] };

export function createParentHomeSummary(children: Child[], entitlements: ServiceEntitlement[], invoices: Invoice[]) {
  const activeEntitlementsByChildId = new Map<string, ServiceEntitlement[]>();
  entitlements.filter((entitlement) => entitlement.status === "ACTIVE").forEach((entitlement) => {
    activeEntitlementsByChildId.set(entitlement.childId, [...(activeEntitlementsByChildId.get(entitlement.childId) ?? []), entitlement]);
  });
  const childrenWithServices: ParentChildSummary[] = children.map((child) => ({
    child,
    activeEntitlements: (activeEntitlementsByChildId.get(child.id) ?? []).sort((left, right) => left.validUntil.localeCompare(right.validUntil)),
  }));
  const actionableInvoices = invoices
    .filter((invoice) => invoice.status === "PENDING" || invoice.status === "PAYMENT_SUBMITTED")
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  return { children: childrenWithServices, actionableInvoices };
}
