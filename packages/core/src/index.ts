import { z } from "zod";

export const roleValues = ["ADMIN", "STAFF", "PARENT"] as const;
export type Role = (typeof roleValues)[number];

export const attendanceMethods = ["MANUAL", "QR"] as const;
export type AttendanceMethod = (typeof attendanceMethods)[number];

export const attendanceActions = ["CHECK_IN", "CHECK_OUT"] as const;
export type AttendanceAction = (typeof attendanceActions)[number];

export const developmentCategories = ["ACTIVITY", "MEAL", "NAP", "OBSERVATION"] as const;
export type DevelopmentCategory = (typeof developmentCategories)[number];

export const servicePlanTypes = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type ServicePlanType = (typeof servicePlanTypes)[number];
export const unusedCreditPolicies = ["CARRY_FORWARD", "EXPIRE"] as const;
export type UnusedCreditPolicy = (typeof unusedCreditPolicies)[number];
export const bookingStatuses = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export const invoiceStatuses = ["PENDING", "PAID", "OVERDUE", "VOID"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const permissions = {
  manageOrganization: ["ADMIN"],
  manageChildren: ["ADMIN", "STAFF"],
  recordAttendance: ["ADMIN", "STAFF"],
  recordDevelopment: ["ADMIN", "STAFF"],
  viewChildDevelopment: ["ADMIN", "STAFF", "PARENT"],
  manageServicePlans: ["ADMIN"],
  approveBookings: ["ADMIN", "STAFF"],
  bookServices: ["PARENT"],
  viewOwnChildren: ["PARENT"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export function can(role: Role, permission: Permission): boolean {
  return (permissions[permission] as readonly Role[]).includes(role);
}

export const childSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().date(),
  classroomId: z.string().uuid().optional(),
});

export const attendanceCommandSchema = z.object({
  action: z.enum(attendanceActions),
  method: z.enum(attendanceMethods),
  qrToken: z.string().min(1).optional(),
  note: z.string().trim().max(500).optional(),
});

export const developmentEntrySchema = z.object({
  category: z.enum(developmentCategories),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2_000),
});

export const purchaseServiceSchema = z.object({
  planId: z.string().uuid(),
  childId: z.string().uuid(),
  bookingDates: z.array(z.string().date()).max(7),
});

export type ChildInput = z.infer<typeof childSchema>;
export type AttendanceCommandInput = z.infer<typeof attendanceCommandSchema>;
export type DevelopmentEntryInput = z.infer<typeof developmentEntrySchema>;
export type PurchaseServiceInput = z.infer<typeof purchaseServiceSchema>;

export type CurrentUser = {
  id: string;
  displayName: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    branchId?: string;
    role: Role;
  }>;
};
