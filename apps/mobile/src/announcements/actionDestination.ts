// Mories Deo Hutapea,S.E.,S.Kom
import type { ParentActionPage } from "@daycare/core";

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
