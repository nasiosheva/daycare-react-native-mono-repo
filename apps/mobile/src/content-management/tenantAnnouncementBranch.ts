// Mories Deo Hutapea,S.E.,S.Kom
import type { TenantBranch } from "@daycare/api-client";

export function tenantAnnouncementBranchName(
  branchId: string | null | undefined,
  branches: readonly TenantBranch[],
): string | null {
  if (!branchId) return null;
  return branches.find((branch) => branch.id === branchId)?.name ?? null;
}
