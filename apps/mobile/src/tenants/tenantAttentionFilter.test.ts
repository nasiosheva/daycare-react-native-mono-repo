// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import { attentionGroupCount } from "./tenantAttentionFilter";

describe("attentionGroupCount", () => {
  it("sums only the statuses belonging to the requested dashboard group", () => {
    const statusCounts = { PENDING_PAYMENT: 3, GRACE: 2, ACTIVE: 10, TRIAL: 1, SUSPENDED: 1, EXPIRED: 1 };
    expect(attentionGroupCount(statusCounts, "ATTENTION")).toBe(5);
    expect(attentionGroupCount(statusCounts, "ACTIVE")).toBe(11);
    expect(attentionGroupCount(statusCounts, "RESTRICTED")).toBe(2);
  });

  it("treats a missing status count as zero", () => {
    expect(attentionGroupCount({}, "ATTENTION")).toBe(0);
    expect(attentionGroupCount({ GRACE: 4 }, "ATTENTION")).toBe(4);
  });
});
