import { useQuery } from "@tanstack/react-query";
import { hasInstitutionCapability, type InstitutionCapability } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { hasBranchOfferingCapability } from "./offeringCapabilities";

export { hasBranchOfferingCapability } from "./offeringCapabilities";

export function useUiAccessContext(enabled = true, organizationId?: string) {
  const { api, organizationId: activeOrganizationId } = useAuth();
  const resolvedOrganizationId = organizationId ?? activeOrganizationId;
  return useQuery({ queryKey: ["ui-access-context", resolvedOrganizationId], queryFn: () => api.uiAccessContext(resolvedOrganizationId ?? undefined), enabled: enabled && Boolean(resolvedOrganizationId) });
}

export function hasOfferingCapability(context: ReturnType<typeof useUiAccessContext>["data"], capability: InstitutionCapability) {
  return context?.offerings.some((offering) => hasInstitutionCapability(offering.capabilities, capability)) ?? false;
}

export function hasLegacyLearningAccess(_capabilities: readonly InstitutionCapability[] | undefined, context: ReturnType<typeof useUiAccessContext>["data"]) {
  return hasOfferingCapability(context, "DAYCARE_OPERATIONS") || hasOfferingCapability(context, "ACADEMIC_CURRICULUM");
}
