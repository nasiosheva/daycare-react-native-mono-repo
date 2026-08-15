import { describe, expect, it } from "vitest";
import { pendingStaffAdminSetupIssues } from "./staffAdminSetupChecklist";

describe("pendingStaffAdminSetupIssues", () => {
  it("keeps the published-offering prerequisite actionable before downstream setup", () => {
    expect(pendingStaffAdminSetupIssues([
      "ACTIVE_SERVICE_PLAN_REQUIRED",
      "PUBLISHED_OFFERING_REQUIRED",
      "OPERATING_HOURS_REQUIRED",
    ])).toEqual([
      "PUBLISHED_OFFERING_REQUIRED",
      "OPERATING_HOURS_REQUIRED",
      "ACTIVE_SERVICE_PLAN_REQUIRED",
    ]);
  });
});
