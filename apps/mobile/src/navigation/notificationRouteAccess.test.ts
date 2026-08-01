import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@daycare/core";
import { canOpenNotificationRoute, isSelfServiceNotificationRoute, notificationRouteWithOrganizationId } from "./notificationRouteAccess";

const profile = (role: "PARENT" | "STAFF" | "STAFF_ADMIN", active = true): CurrentUser => ({
  id: "user",
  displayName: "User",
  gender: "UNSPECIFIED",
  registrationRole: role === "PARENT" ? "PARENT" : undefined,
  isPlatformAdmin: false,
  memberships: [{
    organizationId: "tenant-a",
    organizationName: "Tenant A",
    role,
    active,
    canManageChildPrograms: false,
    canManageDevelopmentCategories: false,
    institutionTypes: ["DAYCARE"],
    capabilities: ["DAYCARE_OPERATIONS"],
  }],
});

describe("canOpenNotificationRoute", () => {
  it("allows Parent enrollment and payer billing without a selected tenant", () => {
    const parent = profile("PARENT");

    expect(canOpenNotificationRoute(parent, null, "/parent-enrollment")).toBe(true);
    expect(canOpenNotificationRoute(parent, null, "/parent-payment?invoiceId=invoice-a")).toBe(true);
    expect(canOpenNotificationRoute(parent, null, "/booking")).toBe(false);
  });

  it("keeps self-service notifications outside tenant selection and passes their verified organization scope only when needed", () => {
    expect(isSelfServiceNotificationRoute("/parent-enrollment")).toBe(true);
    expect(isSelfServiceNotificationRoute("/parent-payment?invoiceId=invoice-a")).toBe(true);
    expect(isSelfServiceNotificationRoute("/booking")).toBe(false);
    expect(notificationRouteWithOrganizationId("/parent-enrollment", "tenant-a")).toBe("/parent-enrollment");
    expect(notificationRouteWithOrganizationId("/parent-payment?invoiceId=invoice-a", "tenant-a")).toBe("/parent-payment?invoiceId=invoice-a&organizationId=tenant-a");
  });

  it("fails closed for stale role, active, capability, and unknown route combinations used by inbox and native actions", () => {
    expect(canOpenNotificationRoute(profile("STAFF", false), "tenant-a", "/staff-operations")).toBe(false);
    expect(canOpenNotificationRoute(profile("STAFF", false), "tenant-a", "/attendance")).toBe(false);
    expect(canOpenNotificationRoute(profile("PARENT"), "tenant-a", "/parent-payments")).toBe(false);
    expect(canOpenNotificationRoute(profile("PARENT"), "tenant-a", "/unrecognized-route")).toBe(false);
  });

  it("keeps an active Staff reminder attendance destination available without Daycare capability", () => {
    const staffWithoutDaycare = {
      ...profile("STAFF"),
      memberships: [{ ...profile("STAFF").memberships[0], institutionTypes: ["PAUD"], capabilities: [] }],
    };

    expect(canOpenNotificationRoute(staffWithoutDaycare, "tenant-a", "/attendance")).toBe(true);
  });

  it("blocks inactive Parent child-data notification routes until a resource-specific server policy exists", () => {
    const inactiveParent = profile("PARENT", false);

    expect(canOpenNotificationRoute(inactiveParent, "tenant-a", "/absence-requests?childId=child-a")).toBe(false);
    expect(canOpenNotificationRoute(inactiveParent, "tenant-a", "/incident-reports?childId=child-a")).toBe(false);
  });
});
