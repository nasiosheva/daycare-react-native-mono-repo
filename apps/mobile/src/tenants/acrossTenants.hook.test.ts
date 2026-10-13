// Mories Deo Hutapea,S.E.,S.Kom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useQueriesMock } = vi.hoisted(() => ({ useQueriesMock: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({ useQueries: useQueriesMock }));

import { useAcrossTenants } from "./acrossTenants";

const tenants = [
  { organizationId: "tenant-a", organizationName: "Tenant A" },
  { organizationId: "tenant-b", organizationName: "Tenant B" },
];

describe("useAcrossTenants", () => {
  beforeEach(() => useQueriesMock.mockReset());

  it("builds one correctly scoped query per tenant and summarizes partial failures", async () => {
    const queryFn = vi.fn(async (tenant: (typeof tenants)[number]) => [tenant.organizationId]);
    const refetchA = vi.fn();
    const refetchB = vi.fn();
    useQueriesMock.mockReturnValue([
      { data: ["child-a"], isError: false, isFetching: false, refetch: refetchA },
      { data: undefined, isError: true, isFetching: false, refetch: refetchB },
    ]);

    const summary = useAcrossTenants({
      tenants,
      queryKey: (tenant) => ["children", tenant.organizationId],
      queryFn,
      enabled: true,
    });
    const config = useQueriesMock.mock.calls[0]![0] as {
      queries: Array<{ queryKey: readonly unknown[]; enabled: boolean; queryFn: () => Promise<string[]> }>;
    };

    expect(config.queries.map((query) => query.queryKey)).toEqual([
      ["children", "tenant-a"],
      ["children", "tenant-b"],
    ]);
    expect(config.queries.every((query) => query.enabled)).toBe(true);
    await config.queries[1]!.queryFn();
    expect(queryFn).toHaveBeenCalledWith(tenants[1]);

    expect(summary.results).toEqual([
      { tenant: tenants[0], data: ["child-a"] },
      { tenant: tenants[1], data: undefined },
    ]);
    expect(summary.failedTenants).toEqual([tenants[1]]);
    expect(summary.allFailed).toBe(false);

    summary.retryFailed();
    expect(refetchA).not.toHaveBeenCalled();
    expect(refetchB).toHaveBeenCalledOnce();
  });

  it("keeps all tenant queries disabled when the caller disables the aggregate", () => {
    useQueriesMock.mockReturnValue([]);

    useAcrossTenants({
      tenants,
      queryKey: (tenant) => ["children", tenant.organizationId],
      queryFn: async () => [],
      enabled: false,
    });

    const config = useQueriesMock.mock.calls[0]![0] as {
      queries: Array<{ enabled: boolean }>;
    };
    expect(config.queries.map((query) => query.enabled)).toEqual([false, false]);
  });
});
