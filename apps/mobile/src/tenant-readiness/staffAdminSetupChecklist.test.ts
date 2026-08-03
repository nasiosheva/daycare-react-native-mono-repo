import { describe, expect, it } from "vitest";
import { pendingStaffAdminSetupIssues } from "./staffAdminSetupChecklist";

describe("pendingStaffAdminSetupIssues", () => {
  it("keeps only Staff-Admin-actionable setup issues in operational order", () => {
    expect(pendingStaffAdminSetupIssues([
      "SUBSCRIPTION_NOT_ACTIVE",
      "PAYMENT_INSTRUCTION_REQUIRED",
      "OPERATING_HOURS_REQUIRED",
      "ACTIVE_BRANCH_REQUIRED",
    ])).toEqual([
      "ACTIVE_BRANCH_REQUIRED",
      "OPERATING_HOURS_REQUIRED",
      "PAYMENT_INSTRUCTION_REQUIRED",
    ]);
  });
});
