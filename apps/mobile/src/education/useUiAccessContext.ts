import { useQueries, useQuery } from "@tanstack/react-query";
import { hasInstitutionCapability, type InstitutionCapability } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { hasBranchOfferingCapability } from "./offeringCapabilities";

export { hasBranchOfferingCapability } from "./offeringCapabilities";

export function useUiAccessContext(enabled = true, organizationId?: string) {
  const { api, organizationId: activeOrganizationId } = useAuth();
  const resolvedOrganizationId = organizationId ?? activeOrganizationId;
  return useQuery({ queryKey: ["ui-access-context", resolvedOrganizationId], queryFn: () => api.uiAccessContext(resolvedOrganizationId ?? undefined), enabled: enabled && Boolean(resolvedOrganizationId) });
}

// Published-offering capabilities per tenant, for screens that act on several tenants at once
// (per-action tenant resolution, docs/business-rules.md §1). Each membership's ui-access-context
// query shares its cache key with useUiAccessContext(enabled, organizationId), so a tenant already
// checked elsewhere isn't refetched here. An unknown or failed tenant reports no capability.
export function useOfferingCapabilitiesByTenant(memberships: readonly { organizationId: string }[], enabled: boolean) {
  const { api } = useAuth();
  const queries = useQueries({
    queries: memberships.map((membership) => ({
      queryKey: ["ui-access-context", membership.organizationId],
      queryFn: () => api.uiAccessContext(membership.organizationId),
      enabled,
    })),
  });
  const contextByTenant = new Map(memberships.map((membership, index) => [membership.organizationId, queries[index]?.data]));
  return {
    hasCapability: (organizationId: string, capability: InstitutionCapability) => hasOfferingCapability(contextByTenant.get(organizationId), capability),
    isLoading: enabled && queries.some((query) => query.isLoading),
  };
}

// For a route that isn't tied to any single active tenant (e.g. a cross-tenant Parent screen),
// "has this capability" means "in at least one of these tenants".
export function useAnyMembershipHasOffering(memberships: readonly { organizationId: string }[], capability: InstitutionCapability, enabled: boolean) {
  const offerings = useOfferingCapabilitiesByTenant(memberships, enabled);
  return { hasCapability: memberships.some((membership) => offerings.hasCapability(membership.organizationId, capability)), isLoading: offerings.isLoading };
}

export function hasOfferingCapability(context: ReturnType<typeof useUiAccessContext>["data"], capability: InstitutionCapability) {
  return context?.offerings.some((offering) => hasInstitutionCapability(offering.capabilities, capability)) ?? false;
}

export function hasLegacyLearningAccess(_capabilities: readonly InstitutionCapability[] | undefined, context: ReturnType<typeof useUiAccessContext>["data"]) {
  return hasOfferingCapability(context, "DAYCARE_OPERATIONS") || hasOfferingCapability(context, "ACADEMIC_CURRICULUM");
}
