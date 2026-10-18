// Mories Deo Hutapea,S.E.,S.Kom
import type { ParentActionPage, PlatformBannerAudience, StaffAdminBannerActionPage } from "@daycare/core";

const parentActionRoutes: Record<ParentActionPage, { pathname: string; tenantScoped: boolean }> = {
  TENANT_ANNOUNCEMENTS: { pathname: "/tenant-announcements", tenantScoped: true },
  BOOKING: { pathname: "/booking", tenantScoped: false },
  PARENT_SCREENING: { pathname: "/parent-screening", tenantScoped: false },
  PARENT_ENROLLMENT: { pathname: "/parent-enrollment-form", tenantScoped: false },
  PRIVATE_TUTORING: { pathname: "/private-tutoring", tenantScoped: false },
};

export function parentActionRoute(page: string | null | undefined): { pathname: string; tenantScoped: boolean } | null {
  if (!page || !Object.prototype.hasOwnProperty.call(parentActionRoutes, page)) return null;
  return parentActionRoutes[page as ParentActionPage];
}

const staffAdminBannerRoutes: Record<StaffAdminBannerActionPage, { pathname: string; tenantScoped: boolean }> = {
  TENANT_CHILDREN: { pathname: "/children", tenantScoped: true },
  TENANT_SUBSCRIPTION: { pathname: "/tenant-subscription", tenantScoped: true },
  TENANT_USERS: { pathname: "/tenant-users", tenantScoped: true },
  TENANT_BRANCHES: { pathname: "/branches", tenantScoped: true },
};

export function platformBannerActionRoute(audience: PlatformBannerAudience | string | null | undefined, page: string | null | undefined): { pathname: string; tenantScoped: boolean } | null {
  if (!page) return null;
  if (audience === "PARENT_GLOBAL" || audience == null) return parentActionRoute(page);
  if (audience !== "STAFF_ADMIN_GLOBAL" && audience !== "TENANT_STAFF_ADMIN") return null;
  if (!Object.prototype.hasOwnProperty.call(staffAdminBannerRoutes, page)) return null;
  return staffAdminBannerRoutes[page as StaffAdminBannerActionPage];
}
