import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidateRealtimeFlags } from "./queryInvalidation";

describe("invalidateRealtimeFlags", () => {
  it("invalidates every query family addressed by multiple flags", () => {
    const client = new QueryClient();
    client.setQueryData(["notifications", "tenant-a"], []);
    client.setQueryData(["invoices", "tenant-a"], []);
    client.setQueryData(["entitlements", "tenant-a"], []);
    client.setQueryData(["children", "tenant-a"], []);

    invalidateRealtimeFlags(client, ["NOTIFICATIONS", "INVOICES", "ENTITLEMENTS"]);

    expect(client.getQueryState(["notifications", "tenant-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["invoices", "tenant-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["entitlements", "tenant-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["children", "tenant-a"])?.isInvalidated).toBe(false);
  });

  it("invalidates server-authorized child placement options after learning changes", () => {
    const client = new QueryClient();
    client.setQueryData(["child-placement-options", "tenant-a", "child-a"], []);

    invalidateRealtimeFlags(client, ["LEARNING"]);

    expect(client.getQueryState(["child-placement-options", "tenant-a", "child-a"])?.isInvalidated).toBe(true);
  });
});
