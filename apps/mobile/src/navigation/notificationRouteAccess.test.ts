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
    expect(canOpenNotificationRoute(inactiveParent, "tenant-a", "/child-health?childId=child-a")).toBe(false);
    expect(canOpenNotificationRoute(inactiveParent, "tenant-a", "/child-messages?childId=child-a")).toBe(false);
  });

  it("opens a non-active tenant's notification only on routes that resolve their tenant per action", () => {
    const parent = profile("PARENT");
    const twoTenantParent: CurrentUser = { ...parent, memberships: [...parent.memberships, { ...parent.memberships[0], organizationId: "tenant-b", organizationName: "Tenant B" }] };

    expect(canOpenNotificationRoute(twoTenantParent, "tenant-b", "/absence-requests?childId=child-b", false, "tenant-a")).toBe(true);
    expect(canOpenNotificationRoute(twoTenantParent, "tenant-b", "/child-messages?childId=child-b", false, "tenant-a")).toBe(true);
    expect(canOpenNotificationRoute(twoTenantParent, "tenant-b", "/booking", true, "tenant-a")).toBe(true);
    expect(notificationRouteWithOrganizationId("/absence-requests?childId=child-b", "tenant-b")).toBe("/absence-requests?childId=child-b&organizationId=tenant-b");
    expect(notificationRouteWithOrganizationId("/child-messages?childId=child-b", "tenant-b")).toBe("/child-messages?childId=child-b&organizationId=tenant-b");
    expect(notificationRouteWithOrganizationId("/booking", "tenant-b")).toBe("/booking");

    const staff = profile("STAFF");
    const twoTenantStaff: CurrentUser = { ...staff, memberships: [...staff.memberships, { ...staff.memberships[0], organizationId: "tenant-b", organizationName: "Tenant B" }] };
    expect(canOpenNotificationRoute(twoTenantStaff, "tenant-b", "/goals?childId=child-b", false, "tenant-a")).toBe(false);
    expect(canOpenNotificationRoute(twoTenantStaff, "tenant-a", "/goals?childId=child-a", false, "tenant-a")).toBe(true);
    expect(canOpenNotificationRoute(twoTenantStaff, "tenant-b", "/goals?childId=child-b")).toBe(true);
  });

  it("opens the health-update and new-message action paths the API sends to guardians and Staff", () => {
    expect(canOpenNotificationRoute(profile("PARENT"), "tenant-a", "/child-health?childId=child-a")).toBe(true);
    expect(canOpenNotificationRoute(profile("PARENT"), "tenant-a", "/child-messages?childId=child-a")).toBe(true);
    expect(canOpenNotificationRoute(profile("STAFF"), "tenant-a", "/child-messages?childId=child-a")).toBe(true);
    expect(canOpenNotificationRoute(profile("STAFF_ADMIN"), "tenant-a", "/child-messages?childId=child-a")).toBe(true);
  });
});
