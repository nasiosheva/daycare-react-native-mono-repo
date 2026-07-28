import { z } from "zod";

export const roleValues = ["ADMIN", "STAFF_ADMIN", "STAFF", "PARENT"] as const;
export type Role = (typeof roleValues)[number];
export const registrationRoleValues = ["PARENT"] as const;
export type RegistrationRole = (typeof registrationRoleValues)[number];

export const attendanceMethods = ["MANUAL", "QR"] as const;
export type AttendanceMethod = (typeof attendanceMethods)[number];

export const attendanceActions = ["CHECK_IN", "CHECK_OUT"] as const;
export type AttendanceAction = (typeof attendanceActions)[number];
export const childAbsencePurposes = ["SICK", "OUT_OF_TOWN", "FAMILY_EVENT", "EMERGENCY", "OTHER"] as const;
export type ChildAbsencePurpose = (typeof childAbsencePurposes)[number];
export const childAbsenceRequestStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type ChildAbsenceRequestStatus = (typeof childAbsenceRequestStatuses)[number];
export const staffLeaveRequestTypes = ["LEAVE", "SICK"] as const;
export type StaffLeaveRequestType = (typeof staffLeaveRequestTypes)[number];
export const staffLeaveRequestStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type StaffLeaveRequestStatus = (typeof staffLeaveRequestStatuses)[number];
export const parentOccupationValues = ["PNS", "PEGAWAI_SWASTA", "PEGAWAI_BUMN", "PENGUSAHA", "WIRASWASTA", "PROFESIONAL", "FREELANCER", "IBU_RUMAH_TANGGA", "TIDAK_BEKERJA", "LAINNYA"] as const;
export type ParentOccupation = (typeof parentOccupationValues)[number];
export const parentIncomeRangeValues = ["NO_INCOME", "UNDER_3_MILLION", "THREE_TO_FIVE_MILLION", "FIVE_TO_TEN_MILLION", "TEN_TO_TWENTY_MILLION", "OVER_TWENTY_MILLION"] as const;
export type ParentIncomeRange = (typeof parentIncomeRangeValues)[number];

export const goalDomains = ["KEMANDIRIAN", "BAHASA_KOMUNIKASI", "KOGNITIF", "MOTORIK_HALUS", "MOTORIK_KASAR", "SOSIAL_EMOSI"] as const;
export type GoalDomain = (typeof goalDomains)[number];
export const childGenders = ["MALE", "FEMALE"] as const;
export type ChildGender = (typeof childGenders)[number];
export type PersonGender = ChildGender | "UNSPECIFIED";
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

export type InstitutionType = string;
export const institutionCapabilities = ["DAYCARE_OPERATIONS", "ACADEMIC_CURRICULUM"] as const;
export type InstitutionCapability = (typeof institutionCapabilities)[number];
export const staffReminderTargets = ["HOME", "ATTENDANCE", "DEVELOPMENT", "CHILDREN", "BOOKING_APPROVALS"] as const;
export type StaffReminderTarget = (typeof staffReminderTargets)[number];

const capabilitiesByInstitutionType: Record<string, readonly InstitutionCapability[]> = {
  DAYCARE: ["DAYCARE_OPERATIONS"],
  PAUD: ["ACADEMIC_CURRICULUM"],
  TK: ["ACADEMIC_CURRICULUM"],
};

export function capabilitiesForInstitutionTypes(types: readonly InstitutionType[]): InstitutionCapability[] {
  return Array.from(new Set(types.flatMap((type) => capabilitiesByInstitutionType[type] ?? [])));
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
  approveChildAbsence: ["STAFF_ADMIN", "STAFF"],
  recordDevelopment: ["STAFF_ADMIN", "STAFF"],
  viewChildDevelopment: ["STAFF_ADMIN", "STAFF", "PARENT"],
  manageGoalCategories: ["STAFF_ADMIN"],
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

export const childAbsenceRequestSchema = z.object({
  childId: z.string().uuid(),
  purpose: z.enum(childAbsencePurposes),
  startDate: z.string().date(),
  endDate: z.string().date(),
  note: z.string().trim().max(500).optional(),
});

export const parentFamilyProfileSchema = z.object({
  husbandDateOfBirth: z.string().date().nullable().optional(),
  husbandOccupation: z.enum(parentOccupationValues).nullable().optional(),
  husbandIncomeRange: z.enum(parentIncomeRangeValues).nullable().optional(),
  wifeDateOfBirth: z.string().date().nullable().optional(),
  wifeOccupation: z.enum(parentOccupationValues).nullable().optional(),
  wifeIncomeRange: z.enum(parentIncomeRangeValues).nullable().optional(),
});

export const developmentEntrySchema = z.object({
  category: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2_000),
  photo: z.object({
    contentType: z.enum(["image/jpeg", "image/png"]),
    dataBase64: z.string().min(1),
  }).optional(),
});

export const purchaseServiceSchema = z.object({
  planId: z.string().uuid(),
  childId: z.string().uuid(),
  bookingDates: z.array(z.string().date()).max(7),
  promoCode: z.string().trim().min(1).max(80).optional(),
});

export type ChildInput = z.infer<typeof childSchema>;
export type AttendanceCommandInput = z.infer<typeof attendanceCommandSchema>;
export type ChildAbsenceRequestInput = z.infer<typeof childAbsenceRequestSchema>;
export type ParentFamilyProfileInput = z.infer<typeof parentFamilyProfileSchema>;
export type DevelopmentEntryInput = z.infer<typeof developmentEntrySchema>;
export type PurchaseServiceInput = z.infer<typeof purchaseServiceSchema>;

export type CurrentUser = {
  id: string;
  displayName: string;
  gender: PersonGender;
  dateOfBirth?: string;
  registrationRole?: RegistrationRole;
  parentFamilyProfile?: ParentFamilyProfile;
  isPlatformAdmin: boolean;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    branchId?: string;
    role: Role;
    active: boolean;
    canManageChildPrograms: boolean;
    canManageDevelopmentCategories: boolean;
    institutionTypes: InstitutionType[];
    capabilities: InstitutionCapability[];
  }>;
};

export type ParentFamilyProfile = {
  husbandDateOfBirth?: string;
  husbandOccupation?: ParentOccupation;
  husbandIncomeRange?: ParentIncomeRange;
  wifeDateOfBirth?: string;
  wifeOccupation?: ParentOccupation;
  wifeIncomeRange?: ParentIncomeRange;
};
