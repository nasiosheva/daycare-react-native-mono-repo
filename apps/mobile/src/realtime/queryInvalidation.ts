import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeFlag } from "@daycare/api-client";

const queryKeysByFlag: Record<RealtimeFlag, readonly string[]> = {
  NOTIFICATIONS: ["notifications"],
  PROFILE: [],
  PARENT_ENROLLMENTS: ["parent-enrollments", "parent-enrollment-catalog"],
  CHILDREN: ["children", "child-profile", "child-placements"],
  ATTENDANCE: ["attendance", "attendance-qr", "children"],
  DEVELOPMENT: ["development-entries"],
  DEVELOPMENT_CATEGORIES: ["development-categories"],
  BOOKINGS: ["bookings"],
  INVOICES: ["invoices", "invoice", "payment-proof"],
  ENTITLEMENTS: ["entitlements"],
  SERVICE_PLANS: ["service-plans", "service-plan-templates", "service-plan-discounts", "branch-capacities"],
  BRANCHES: ["tenant-branches", "learning-branches", "branch-capacities"],
  TENANT_USERS: ["tenant-users"],
  LEARNING: ["learning-levels", "classrooms", "classroom-staff", "classroom-programs", "child-placements"],
  ACADEMIC: ["learning-periods", "curriculum-programs", "curriculum-activities", "curriculum-activity-assessments", "learning-level-templates"],
  TENANTS: ["platform-tenants", "platform-tenant"],
  GLOBAL_CURRICULUM: ["global-curriculum-programs"],
  GOALS: ["goal-templates", "child-goals"],
  STAFF_REMINDERS: ["staff-reminders"],
};

export function invalidateRealtimeFlags(queryClient: QueryClient, flags: readonly RealtimeFlag[]): void {
  new Set(flags.flatMap((flag) => queryKeysByFlag[flag])).forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }));
}

export const allRealtimeFlags = Object.keys(queryKeysByFlag) as RealtimeFlag[];
