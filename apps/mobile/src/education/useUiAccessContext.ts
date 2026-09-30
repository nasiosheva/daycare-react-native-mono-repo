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

// For a route that isn't tied to any single active tenant (e.g. a cross-tenant Parent screen),
// "has this capability" means "in at least one of these tenants" — each membership's own
// ui-access-context query shares its cache key with useUiAccessContext(enabled, organizationId),
// so a tenant already checked elsewhere isn't refetched here.
export function useAnyMembershipHasOffering(memberships: readonly { organizationId: string }[], capability: InstitutionCapability, enabled: boolean) {
  const { api } = useAuth();
  const queries = useQueries({
    queries: memberships.map((membership) => ({
      queryKey: ["ui-access-context", membership.organizationId],
      queryFn: () => api.uiAccessContext(membership.organizationId),
      enabled,
    })),
  });
  const isLoading = enabled && queries.some((query) => query.isLoading);
  const hasCapability = queries.some((query) => hasOfferingCapability(query.data, capability));
  return { hasCapability, isLoading };
}

export function hasOfferingCapability(context: ReturnType<typeof useUiAccessContext>["data"], capability: InstitutionCapability) {
  return context?.offerings.some((offering) => hasInstitutionCapability(offering.capabilities, capability)) ?? false;
}

export function hasLegacyLearningAccess(_capabilities: readonly InstitutionCapability[] | undefined, context: ReturnType<typeof useUiAccessContext>["data"]) {
  return hasOfferingCapability(context, "DAYCARE_OPERATIONS") || hasOfferingCapability(context, "ACADEMIC_CURRICULUM");
}
