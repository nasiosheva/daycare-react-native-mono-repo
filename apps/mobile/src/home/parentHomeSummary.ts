import type { Child, ChildProgramSummary, Invoice, PlatformBanner, ServiceEntitlement, TenantAnnouncement } from "@daycare/api-client";

// Mories Deo Hutapea,S.E.,S.Kom

type ParentAnnouncementCardItem = Pick<TenantAnnouncement, "id" | "title" | "body" | "imageUrl" | "actionType" | "actionTarget" | "publishedAt" | "requiresAcknowledgement" | "acknowledgedByMe">;

export type ParentAnnouncementSlide = { announcement: ParentAnnouncementCardItem; organizationId: string; organizationName: string };

export function combineParentAnnouncements<TAnnouncement extends ParentAnnouncementCardItem>(results: readonly {
  tenant: { organizationId: string; organizationName: string };
  data: readonly TAnnouncement[] | undefined;
}[]): ParentAnnouncementSlide[] {
  return results.flatMap(({ tenant, data }) => (data ?? []).map((announcement) => ({
    announcement,
    organizationId: tenant.organizationId,
    organizationName: tenant.organizationName,
  }))).sort((left, right) => (right.announcement.publishedAt ?? "").localeCompare(left.announcement.publishedAt ?? ""));
}

export function combineParentPromotions(platformBanners: readonly PlatformBanner[]): PlatformBanner[] {
  return [...platformBanners].sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
}

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
