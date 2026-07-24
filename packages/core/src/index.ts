import { z } from "zod";

export const roleValues = ["ADMIN", "STAFF_ADMIN", "STAFF", "PARENT"] as const;
export type Role = (typeof roleValues)[number];
export const registrationRoleValues = ["PARENT"] as const;
export type RegistrationRole = (typeof registrationRoleValues)[number];

export const attendanceMethods = ["MANUAL", "QR"] as const;
export type AttendanceMethod = (typeof attendanceMethods)[number];

export const attendanceActions = ["CHECK_IN", "CHECK_OUT"] as const;
export type AttendanceAction = (typeof attendanceActions)[number];

export const developmentCategories = ["ACTIVITY", "MEAL", "NAP", "OBSERVATION"] as const;
export type DevelopmentCategory = (typeof developmentCategories)[number];
export const childGenders = ["MALE", "FEMALE"] as const;
export type ChildGender = (typeof childGenders)[number];
export const goalCheckInOutcomes = ["YES", "NO"] as const;
export type GoalCheckInOutcome = (typeof goalCheckInOutcomes)[number];
export const childGoalOutcomes = ["ACHIEVED", "NOT_ACHIEVED"] as const;
export type ChildGoalOutcome = (typeof childGoalOutcomes)[number];

export const servicePlanTypes = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type ServicePlanType = (typeof servicePlanTypes)[number];
export const unusedCreditPolicies = ["CARRY_FORWARD", "EXPIRE"] as const;
export type UnusedCreditPolicy = (typeof unusedCreditPolicies)[number];
export const servicePlanDiscountKinds = ["AUTOMATIC", "PROMO_CODE"] as const;
export type ServicePlanDiscountKind = (typeof servicePlanDiscountKinds)[number];
export const servicePlanDiscountTypes = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export type ServicePlanDiscountType = (typeof servicePlanDiscountTypes)[number];
export const bookingStatuses = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export const invoiceStatuses = ["PENDING", "PAYMENT_SUBMITTED", "PAID", "OVERDUE", "VOID"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];
export const tenantSubscriptionPlans = ["STARTER", "STANDARD", "PREMIUM"] as const;
export type TenantSubscriptionPlan = (typeof tenantSubscriptionPlans)[number];
export const tenantSubscriptionStatuses = ["TRIAL", "PENDING_PAYMENT", "ACTIVE", "SUSPENDED", "EXPIRED"] as const;
export type TenantSubscriptionStatus = (typeof tenantSubscriptionStatuses)[number];
export const tenantPaymentStatuses = ["PENDING", "PAID", "VOID"] as const;
export type TenantPaymentStatus = (typeof tenantPaymentStatuses)[number];

export const institutionTypes = ["DAYCARE", "PAUD", "TK"] as const;
export type InstitutionType = (typeof institutionTypes)[number];
export const institutionCapabilities = ["DAYCARE_OPERATIONS", "ACADEMIC_CURRICULUM"] as const;
export type InstitutionCapability = (typeof institutionCapabilities)[number];
export const staffReminderTargets = ["HOME", "ATTENDANCE", "DEVELOPMENT", "CHILDREN", "BOOKING_APPROVALS"] as const;
export type StaffReminderTarget = (typeof staffReminderTargets)[number];

const capabilitiesByInstitutionType: Record<InstitutionType, readonly InstitutionCapability[]> = {
  DAYCARE: ["DAYCARE_OPERATIONS"],
  PAUD: ["ACADEMIC_CURRICULUM"],
  TK: ["ACADEMIC_CURRICULUM"],
};

export function capabilitiesForInstitutionTypes(types: readonly InstitutionType[]): InstitutionCapability[] {
  return Array.from(new Set(types.flatMap((type) => capabilitiesByInstitutionType[type])));
}

export function hasInstitutionCapability(capabilities: readonly InstitutionCapability[] | undefined, capability: InstitutionCapability): boolean {
  return capabilities?.includes(capability) ?? false;
}

export const permissions = {
  manageTenants: ["ADMIN"],
  manageTenantSubscriptions: ["ADMIN"],
  manageOrganization: ["STAFF_ADMIN"],
  manageTenantUsers: ["STAFF_ADMIN"],
  manageChildren: ["STAFF_ADMIN", "STAFF"],
  recordAttendance: ["STAFF"],
  recordDevelopment: ["STAFF_ADMIN", "STAFF"],
  viewChildDevelopment: ["STAFF_ADMIN", "STAFF", "PARENT"],
  manageGoalTemplates: ["STAFF_ADMIN"],
  assignChildGoals: ["STAFF_ADMIN"],
  recordChildGoalProgress: ["STAFF_ADMIN", "STAFF"],
  viewChildGoalProgress: ["STAFF_ADMIN", "STAFF", "PARENT"],
  manageServicePlans: ["STAFF_ADMIN"],
  approveBookings: ["STAFF_ADMIN", "STAFF"],
  bookServices: ["PARENT"],
  viewOwnChildren: ["PARENT"],
  manageLearningStructure: ["STAFF_ADMIN"],
  manageChildPlacements: ["STAFF_ADMIN", "STAFF"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export function can(role: Role, permission: Permission): boolean {
  return (permissions[permission] as readonly Role[]).includes(role);
}

export const childSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  nisn: z.string().trim().max(20).optional(),
  gender: z.enum(childGenders),
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
  promoCode: z.string().trim().min(1).max(80).optional(),
});

export type ChildInput = z.infer<typeof childSchema>;
export type AttendanceCommandInput = z.infer<typeof attendanceCommandSchema>;
export type DevelopmentEntryInput = z.infer<typeof developmentEntrySchema>;
export type PurchaseServiceInput = z.infer<typeof purchaseServiceSchema>;

export type CurrentUser = {
  id: string;
  displayName: string;
  registrationRole?: RegistrationRole;
  isPlatformAdmin: boolean;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    branchId?: string;
    role: Role;
    active: boolean;
    canManageChildPrograms: boolean;
    institutionTypes: InstitutionType[];
    capabilities: InstitutionCapability[];
  }>;
};
