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
  CHILD_CARE_LOGS: ["child-care-logs"],
  STAFF_HANDOVERS: ["child-handovers"],
  TENANT_ANNOUNCEMENTS: ["announcements", "managed-announcements"],
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
  TENANT_FEEDBACK: ["tenant-feedback-mine", "tenant-feedback-inbox"],
  CHILD_MESSAGES: ["child-messages", "child-message-summary", "child-message-unread-summary"],
};

export function invalidateRealtimeFlags(queryClient: QueryClient, flags: readonly RealtimeFlag[], organizationId?: string | null, userId?: string | null, payload?: unknown): void {
  const childMessageChildId = flags.includes("CHILD_MESSAGES") ? readChildMessageChildId(payload) : undefined;
  new Set(flags.flatMap((flag) => queryKeysByFlag[flag])).forEach((key) => {
    if ((key === "child-messages" || key === "child-message-summary") && organizationId && childMessageChildId) {
      void queryClient.invalidateQueries({ queryKey: [key, organizationId, childMessageChildId] });
      return;
    }
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

function readChildMessageChildId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const childId = (payload as { childId?: unknown }).childId;
  return typeof childId === "string" && childId.length > 0 ? childId : undefined;
}

export const allRealtimeFlags = Object.keys(queryKeysByFlag) as RealtimeFlag[];
