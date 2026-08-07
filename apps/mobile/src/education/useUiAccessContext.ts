import { useQuery } from "@tanstack/react-query";
import { hasInstitutionCapability, type InstitutionCapability } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { hasBranchOfferingCapability } from "./offeringCapabilities";

export { hasBranchOfferingCapability } from "./offeringCapabilities";

export function useUiAccessContext(enabled = true) {
  const { api, organizationId } = useAuth();
  return useQuery({ queryKey: ["ui-access-context", organizationId], queryFn: () => api.uiAccessContext(), enabled: enabled && Boolean(organizationId) });
}

export function hasOfferingCapability(context: ReturnType<typeof useUiAccessContext>["data"], capability: InstitutionCapability) {
  return context?.offerings.some((offering) => hasInstitutionCapability(offering.capabilities, capability)) ?? false;
}

export function hasLegacyLearningAccess(capabilities: readonly InstitutionCapability[] | undefined, context: ReturnType<typeof useUiAccessContext>["data"]) {
  return hasInstitutionCapability(capabilities ?? [], "DAYCARE_OPERATIONS") || hasOfferingCapability(context, "ACADEMIC_CURRICULUM");
}
