import { hasInstitutionCapability, type InstitutionCapability } from "@daycare/core";
import type { UiAccessContext } from "@daycare/api-client";

export function hasBranchOfferingCapability(context: UiAccessContext | undefined, branchId: string | null | undefined, capability: InstitutionCapability) {
  return Boolean(branchId && context?.offerings.some((offering) => offering.branchId === branchId && hasInstitutionCapability(offering.capabilities, capability)));
}
