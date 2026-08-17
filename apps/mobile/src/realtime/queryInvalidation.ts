import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeFlag } from "@daycare/api-client";

const queryKeysByFlag: Record<RealtimeFlag, readonly string[]> = {
  NOTIFICATIONS: ["notifications"],
  PROFILE: [],
  PARENT_ENROLLMENTS: ["parent-enrollments", "parent-enrollment-catalog"],
  CHILDREN: ["children", "child-profile", "child-placements"],
  ATTENDANCE: ["attendance", "attendance-qr", "children"],
  ABSENCE_REQUESTS: ["child-absence-requests"],
  INCIDENT_REPORTS: ["child-incident-reports"],
  HEALTH: ["child-health-record"],
  DEVELOPMENT: ["development-entries"],
  DEVELOPMENT_CATEGORIES: ["development-categories"],
  BOOKINGS: ["bookings"],
  INVOICES: ["invoices", "invoice", "payment-proof"],
  ENTITLEMENTS: ["entitlements"],
  SERVICE_PLANS: ["service-plans", "service-plan-templates", "service-plan-discounts", "branch-capacities"],
  BRANCHES: ["tenant-branches", "learning-branches", "branch-capacities"],
  TENANT_USERS: ["tenant-users"],
  LEARNING: ["learning-levels", "classrooms", "classroom-staff", "classroom-programs", "child-placements", "child-placement-options"],
  ACADEMIC: ["learning-periods", "curriculum-programs", "curriculum-activities", "curriculum-activity-assessments", "learning-level-templates"],
  TENANTS: ["platform-tenants", "platform-tenant"],
  GLOBAL_CURRICULUM: ["global-curriculum-programs"],
  GOALS: ["goal-templates", "child-goals"],
  STAFF_REMINDERS: ["staff-reminders"],
  STAFF_LEAVE_REQUESTS: ["staff-leave-requests", "staff-leave-approvals"],
  PRIVATE_TUTORING: ["private-tutoring-services", "private-tutoring-requests", "private-tutoring-admin-services", "private-tutoring-tutors", "private-tutoring-admin-requests"],
  CHILD_PROGRAMS: ["child-profile", "parent-child-profile"],
};

export function invalidateRealtimeFlags(queryClient: QueryClient, flags: readonly RealtimeFlag[], organizationId?: string | null, userId?: string | null): void {
  new Set(flags.flatMap((flag) => queryKeysByFlag[flag])).forEach((key) => {
    if (key === "parent-enrollments") {
      if (organizationId) void queryClient.invalidateQueries({ queryKey: [key, organizationId] });
      if (userId) void queryClient.invalidateQueries({ queryKey: [key, "self", userId] });
      if (!organizationId && !userId) void queryClient.invalidateQueries({ queryKey: [key] });
      return;
    }
    if (key === "parent-enrollment-catalog") {
      void queryClient.invalidateQueries({ queryKey: userId ? [key, userId] : [key] });
      return;
    }
    if (key === "invoice") {
      if (organizationId) void queryClient.invalidateQueries({ queryKey: [key, organizationId] });
      if (userId) void queryClient.invalidateQueries({ queryKey: [key, userId] });
      if (!organizationId && !userId) void queryClient.invalidateQueries({ queryKey: [key] });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: organizationId ? [key, organizationId] : [key] });
  });
}

export const allRealtimeFlags = Object.keys(queryKeysByFlag) as RealtimeFlag[];
