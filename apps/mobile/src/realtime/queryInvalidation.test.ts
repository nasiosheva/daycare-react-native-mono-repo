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

    invalidateRealtimeFlags(client, ["NOTIFICATIONS", "INVOICES", "ENTITLEMENTS"], "tenant-a");

    expect(client.getQueryState(["notifications", "tenant-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["invoices", "tenant-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["entitlements", "tenant-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["children", "tenant-a"])?.isInvalidated).toBe(false);
  });

  it("invalidates server-authorized child placement options after learning changes", () => {
    const client = new QueryClient();
    client.setQueryData(["child-placement-options", "tenant-a", "child-a"], []);

    invalidateRealtimeFlags(client, ["LEARNING"], "tenant-a");

    expect(client.getQueryState(["child-placement-options", "tenant-a", "child-a"])?.isInvalidated).toBe(true);
  });

  it("invalidates Parent and Staff Admin private tutoring queries", () => {
    const client = new QueryClient();
    client.setQueryData(["private-tutoring-services", "tenant-a", "child-a"], []);
    client.setQueryData(["private-tutoring-admin-requests", "tenant-a"], []);

    invalidateRealtimeFlags(client, ["PRIVATE_TUTORING"], "tenant-a");

    expect(client.getQueryState(["private-tutoring-services", "tenant-a", "child-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["private-tutoring-admin-requests", "tenant-a"])?.isInvalidated).toBe(true);
  });

  it("does not invalidate another tenant's cache", () => {
    const client = new QueryClient();
    client.setQueryData(["invoices", "tenant-a"], []);
    client.setQueryData(["invoices", "tenant-b"], []);

    invalidateRealtimeFlags(client, ["INVOICES"], "tenant-a");

    expect(client.getQueryState(["invoices", "tenant-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["invoices", "tenant-b"])?.isInvalidated).toBe(false);
  });

  it("invalidates only the current Parent's self-enrollment cache", () => {
    const client = new QueryClient();
    client.setQueryData(["parent-enrollments", "self", "parent-a"], []);
    client.setQueryData(["parent-enrollments", "self", "parent-b"], []);
    client.setQueryData(["parent-enrollments", "tenant-a", "pending"], []);

    invalidateRealtimeFlags(client, ["PARENT_ENROLLMENTS"], "tenant-a", "parent-a");

    expect(client.getQueryState(["parent-enrollments", "self", "parent-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["parent-enrollments", "self", "parent-b"])?.isInvalidated).toBe(false);
    expect(client.getQueryState(["parent-enrollments", "tenant-a", "pending"])?.isInvalidated).toBe(true);
  });

  it("invalidates the current payer invoice detail without invalidating another Parent's detail", () => {
    const client = new QueryClient();
    client.setQueryData(["invoice", "parent-a", "invoice-a"], {});
    client.setQueryData(["invoice", "parent-b", "invoice-b"], {});

    invalidateRealtimeFlags(client, ["INVOICES"], "tenant-a", "parent-a");

    expect(client.getQueryState(["invoice", "parent-a", "invoice-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["invoice", "parent-b", "invoice-b"])?.isInvalidated).toBe(false);
  });
});
