import { describe, expect, it } from "vitest";
import { hasBranchOfferingCapability } from "./offeringCapabilities";

describe("hasBranchOfferingCapability", () => {
  it("requires the capability on the child's own published branch offering", () => {
    const context = {
      organizationId: "tenant-a",
      role: "STAFF_ADMIN" as const,
      active: true,
      revision: 1,
      offerings: [
        { id: "daycare-a", branchId: "branch-daycare", institutionType: "DAYCARE" as const, enrollmentMode: "DAYCARE_SERVICE" as const, capabilities: ["DAYCARE_OPERATIONS" as const], status: "PUBLISHED" as const, programCode: "DEFAULT", revision: 1 },
        { id: "paud-b", branchId: "branch-paud", institutionType: "PAUD" as const, enrollmentMode: "SCHOOL_ADMISSION" as const, capabilities: ["ACADEMIC_CURRICULUM" as const], status: "PUBLISHED" as const, programCode: "DEFAULT", revision: 1 },
      ],
    };

    expect(hasBranchOfferingCapability(context, "branch-daycare", "DAYCARE_OPERATIONS")).toBe(true);
    expect(hasBranchOfferingCapability(context, "branch-paud", "DAYCARE_OPERATIONS")).toBe(false);
  });
});
