import type { Child, ChildProgramSummary, Invoice, ServiceEntitlement } from "@daycare/api-client";

// The Home "Programs" shortcut sums every tenant's active programs and opens the first child that
// has one, together with that child's own tenant (per-action tenant resolution).
export function combineProgramSummaries(results: readonly { tenant: { organizationId: string }; data: ChildProgramSummary | undefined }[]) {
  const activePrograms = results.reduce((total, { data }) => total + (data?.activePrograms ?? 0), 0);
  const first = results.find(({ data }) => Boolean(data?.childIds[0]));
  return { activePrograms, firstChild: first?.data ? { childId: first.data.childIds[0], organizationId: first.tenant.organizationId } : null };
}

export type ParentChildSummary<TChild extends Child = Child> = { child: TChild; activeEntitlements: ServiceEntitlement[] };

export function createParentHomeSummary<TChild extends Child, TInvoice extends Invoice>(children: TChild[], entitlements: ServiceEntitlement[], invoices: TInvoice[]) {
  const activeEntitlementsByChildId = new Map<string, ServiceEntitlement[]>();
  entitlements.filter((entitlement) => entitlement.status === "ACTIVE").forEach((entitlement) => {
    activeEntitlementsByChildId.set(entitlement.childId, [...(activeEntitlementsByChildId.get(entitlement.childId) ?? []), entitlement]);
  });
  const childrenWithServices: ParentChildSummary<TChild>[] = children.map((child) => ({
    child,
    activeEntitlements: (activeEntitlementsByChildId.get(child.id) ?? []).sort((left, right) => left.validUntil.localeCompare(right.validUntil)),
  }));
  const actionableInvoices = invoices
    .filter((invoice) => invoice.status === "PENDING" || invoice.status === "PAYMENT_SUBMITTED")
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  return { children: childrenWithServices, actionableInvoices };
}
