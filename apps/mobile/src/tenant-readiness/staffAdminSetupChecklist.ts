import type { TenantReadinessIssue } from "@daycare/api-client";

const staffAdminSetupIssueOrder = [
  "ACTIVE_BRANCH_REQUIRED",
  "OPERATING_HOURS_REQUIRED",
  "ACTIVE_CLASSROOM_REQUIRED",
  "ACTIVE_SERVICE_PLAN_REQUIRED",
  "BRANCH_CAPACITY_REQUIRED",
  "PAYMENT_INSTRUCTION_REQUIRED",
] as const satisfies readonly TenantReadinessIssue[];

export function pendingStaffAdminSetupIssues(issues: readonly TenantReadinessIssue[] | undefined) {
  const pending = new Set(issues);
  return staffAdminSetupIssueOrder.filter((issue) => pending.has(issue));
}
