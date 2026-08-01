import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { isParentSelfServiceRoute, shouldBlockParentSelfServiceRoute } from "./parentSelfServiceRouteAccess";

const profile = (registrationRole?: "PARENT"): CurrentUser => ({
  id: "user",
  displayName: "User",
  gender: "UNSPECIFIED",
  registrationRole,
  isPlatformAdmin: false,
  memberships: [],
});

describe("Parent self-service route access", () => {
  it("recognizes only the explicit global Parent self-service paths", () => {
    expect(isParentSelfServiceRoute("/parent-enrollment")).toBe(true);
    expect(isParentSelfServiceRoute("/payment-proof")).toBe(true);
    expect(isParentSelfServiceRoute("/booking")).toBe(false);
  });

  it("blocks a non-Parent profile from a direct self-service URL", () => {
    expect(shouldBlockParentSelfServiceRoute(profile(), "/parent-payment")).toBe(true);
    expect(shouldBlockParentSelfServiceRoute(profile("PARENT"), "/parent-payment")).toBe(false);
  });
});
