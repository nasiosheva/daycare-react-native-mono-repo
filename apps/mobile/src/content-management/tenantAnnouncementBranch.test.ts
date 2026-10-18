// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import { tenantAnnouncementBranchName } from "./tenantAnnouncementBranch";

describe("tenantAnnouncementBranchName", () => {
  it("resolves active or inactive branch names by branch id", () => {
    const branches = [
      { id: "branch-active", name: "Cabang Utama", timezone: "Asia/Jakarta", active: true, primary: true },
      { id: "branch-inactive", name: "Cabang Lama", timezone: "Asia/Jakarta", active: false, primary: false },
    ];

    expect(tenantAnnouncementBranchName("branch-active", branches)).toBe("Cabang Utama");
    expect(tenantAnnouncementBranchName("branch-inactive", branches)).toBe("Cabang Lama");
  });

  it("returns null when the announcement does not have a resolvable branch", () => {
    expect(tenantAnnouncementBranchName(null, [])).toBeNull();
    expect(tenantAnnouncementBranchName("missing-branch", [])).toBeNull();
  });
});
