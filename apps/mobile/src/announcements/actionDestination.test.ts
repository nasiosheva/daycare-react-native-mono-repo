import { describe, expect, it } from "vitest";
import { parentActionRoute } from "./actionDestination";

// Mories Deo Hutapea,S.E.,S.Kom
describe("parentActionRoute", () => {
  it("maps only supported page keys to application routes", () => {
    expect(parentActionRoute("BOOKING")).toEqual({ pathname: "/booking", tenantScoped: false });
    expect(parentActionRoute("TENANT_ANNOUNCEMENTS")).toEqual({ pathname: "/tenant-announcements", tenantScoped: true });
    expect(parentActionRoute("PARENT_SCREENING")).toEqual({ pathname: "/parent-screening", tenantScoped: false });
    expect(parentActionRoute("PARENT_ENROLLMENT")).toEqual({ pathname: "/parent-enrollment-form", tenantScoped: false });
    expect(parentActionRoute("PRIVATE_TUTORING")).toEqual({ pathname: "/private-tutoring", tenantScoped: false });
    expect(parentActionRoute("/children?childId=untrusted")).toBeNull();
  });
});
