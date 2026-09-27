import { describe, expect, it } from "vitest";
import { hasOperationalTenantSubscription } from "./tenantSubscription";

describe("tenant subscription access", () => {
  it("allows active and trial subscriptions", () => {
    expect(hasOperationalTenantSubscription("ACTIVE")).toBe(true);
    expect(hasOperationalTenantSubscription("TRIAL")).toBe(true);
  });

  it("blocks billing-blocked subscriptions", () => {
    expect(hasOperationalTenantSubscription("PENDING_PAYMENT")).toBe(false);
    expect(hasOperationalTenantSubscription("SUSPENDED")).toBe(false);
    expect(hasOperationalTenantSubscription("EXPIRED")).toBe(false);
  });

  it("keeps older profile responses compatible", () => {
    expect(hasOperationalTenantSubscription(undefined)).toBe(true);
    expect(hasOperationalTenantSubscription(null)).toBe(true);
  });
});
