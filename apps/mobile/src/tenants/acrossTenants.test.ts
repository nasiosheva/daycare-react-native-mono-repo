import { describe, expect, it } from "vitest";
import { summarizeAcrossTenants } from "./acrossTenants";

const tenants = [
  { organizationId: "a", organizationName: "A" },
  { organizationId: "b", organizationName: "B" },
];

describe("summarizeAcrossTenants", () => {
  it("keeps every loaded tenant's data and reports only the failed tenant", () => {
    const summary = summarizeAcrossTenants(tenants, [
      { data: ["a1"], isError: false, isFetching: false },
      { data: undefined, isError: true, isFetching: false },
    ]);

    expect(summary.results).toEqual([{ tenant: tenants[0], data: ["a1"] }, { tenant: tenants[1], data: undefined }]);
    expect(summary.failedTenants).toEqual([tenants[1]]);
    expect(summary.allFailed).toBe(false);
    expect(summary.isFetching).toBe(false);
  });

  it("flags allFailed only when every tenant failed, and never for an empty tenant list", () => {
    expect(summarizeAcrossTenants(tenants, [
      { data: undefined, isError: true, isFetching: false },
      { data: undefined, isError: true, isFetching: true },
    ])).toMatchObject({ allFailed: true, isFetching: true });
    expect(summarizeAcrossTenants([], [])).toMatchObject({ allFailed: false, failedTenants: [], results: [] });
  });
});
