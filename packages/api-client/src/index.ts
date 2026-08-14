import type { AttendanceAction, AttendanceMethod, BookingStatus, ChildAbsencePurpose, ChildAbsenceRequestStatus, ChildGender, ChildGoalOutcome, ChildInput, CurrentUser, DevelopmentEntryInput, EducationEnrollmentMode, EducationOfferingStatus, GoalDomain, GoalCheckInOutcome, InstitutionCapability, InstitutionType, InvoiceStatus, ParentFamilyProfileInput, ParentIncomeRange, ParentOccupation, PurchaseServiceInput, Role, ServicePlanDiscountKind, ServicePlanDiscountType, ServicePlanType, StaffLeaveRequestStatus, StaffLeaveRequestType, StaffReminderTarget, TenantPaymentStatus, TenantSubscriptionPlan, TenantSubscriptionStatus, UnusedCreditPolicy } from "@daycare/core";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export class ApiNetworkError extends Error {
  constructor() {
    super("The API server could not be reached");
    this.name = "ApiNetworkError";
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super("The API server took too long to respond");
    this.name = "ApiTimeoutError";
  }
}

export function isApiNetworkError(error: unknown): error is ApiNetworkError {
  return error instanceof ApiNetworkError;
}

export function isApiTimeoutError(error: unknown): error is ApiTimeoutError {
  return error instanceof ApiTimeoutError;
}

export const API_REQUEST_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = API_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  let timedOut = false;
  const callerSignal = init.signal;
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  getOrganizationId: () => string | null;
  getLanguage: () => string;
  onRequestLog?: (entry: ApiRequestLogEntry) => void;
};

export type ApiRequestLogEntry = {
  phase: "REQUEST" | "RESPONSE" | "FAILURE";
  method: string;
  url: string;
  durationMs?: number;
  status?: number;
  failure?: "NETWORK" | "TIMEOUT";
};

export type ChildGuardianStatus = "LINKED" | "UNLINKED" | "REVIEW_REQUIRED";
export type AttendancePolicy = "DAYCARE_BOOKING_REQUIRED" | "NONE";
export type AttendanceContext = { operationalDate: string; timezone: string; attendancePolicy: AttendancePolicy; allowedActions: AttendanceAction[]; unavailableReason?: string | null };
export type Child = Omit<ChildInput, "gender"> & { id: string; fullName: string; organizationId: string; branchId: string; gender: ChildGender | "UNSPECIFIED"; todayCheckedInAt?: string | null; todayCheckedOutAt?: string | null; guardianStatus?: ChildGuardianStatus | null; attendanceContext?: AttendanceContext | null };
export type BranchListFilter = { branchId?: string };
export type ChildListFilter = { branchId?: string; learningLevelId?: string; classroomId?: string; guardianStatus?: ChildGuardianStatus };
export type ChildAttendanceReportFilter = { branchId: string; startsOn: string; endsOn: string };
export type UpdateChildInput = Omit<ChildInput, "classroomId">;
export type ChildProgramStatus = "ACTIVE" | "COMPLETED" | "DISCONTINUED";
export type ChildProgramStep = { id: string; title: string; description: string; homeGuidance?: string | null; parentVisible: boolean; completed: boolean; displayOrder: number };
export type ChildProgramStaffNote = { id: string; stepId?: string | null; note: string; authorName: string; recordedAt: string };
export type ChildProgramParentFeedback = { id: string; note: string; parentName?: string | null; createdAt: string };
export type ChildProgram = { id: string; name: string; description: string; status: ChildProgramStatus; parentVisible: boolean; parentSummary?: string | null; homeGuidance?: string | null; steps: ChildProgramStep[]; staffNotes: ChildProgramStaffNote[]; parentFeedback: ChildProgramParentFeedback[] };
export type ParentChildProgram = { id: string; name: string; parentSummary?: string | null; status: ChildProgramStatus; homeGuidance?: string | null; steps: ChildProgramStep[]; feedback: ChildProgramParentFeedback[] };
export type CreateChildProgramInput = { name: string; description?: string; parentVisible?: boolean; parentSummary?: string; homeGuidance?: string };
export type UpdateChildProgramInput = { name: string; description?: string; status: ChildProgramStatus; parentVisible: boolean; parentSummary?: string; homeGuidance?: string };
export type CreateChildProgramStepInput = { title: string; description?: string; homeGuidance?: string; parentVisible?: boolean; displayOrder?: number };
export type UpdateChildProgramStepInput = { title: string; description?: string; homeGuidance?: string; parentVisible: boolean; completed: boolean; displayOrder: number };
export type ChildAssignmentRole = "STAFF" | "NURSE" | "MISS";
export type ChildStaffAssignment = { id: string; userId: string; displayName: string; email?: string | null; assignmentRole: ChildAssignmentRole };
export type ChildGuardian = { userId: string; displayName: string; email?: string | null; username?: string | null; validParentAccount: boolean };
export type ChildProfile = { child: Child; programs: ChildProgram[]; staffAssignments: ChildStaffAssignment[]; guardians: ChildGuardian[] };
export type Attendance = {
  id: string;
  childId: string;
  operationalDate: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  method: AttendanceMethod;
};
export type PickupAuthorizationStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "REVOKED";
export type PickupVerificationMethod = "PHOTO_ID" | "KNOWN_TO_GUARDIAN" | "OTHER";
export type PickupAuthorization = { id: string; childId: string; pickupPersonName: string; relationship: string; verificationMethod: PickupVerificationMethod; status: PickupAuthorizationStatus; effectiveFrom: string; effectiveUntil?: string | null; createdAt: string; canRevoke: boolean };
export type CreatePickupAuthorizationInput = { pickupPersonName: string; relationship: string; verificationMethod: PickupVerificationMethod; effectiveFrom?: string; effectiveUntil?: string };
export type EmergencyContactStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export type EmergencyContact = { id: string; childId: string; name: string; relationship: string; phoneNumber: string; status: EmergencyContactStatus; effectiveUntil?: string | null; canRemove: boolean; canRevoke: boolean };
export type CreateEmergencyContactInput = { name: string; relationship: string; phoneNumber: string; effectiveUntil?: string };
export type ConsentPurpose = "MEDIA_MARKETING" | "HEALTH_EMERGENCY" | "MEDICATION" | "OUTING" | "PICKUP";
export type ConsentStatus = "PENDING" | "GRANTED" | "DECLINED" | "WITHDRAWN" | "EXPIRED" | "SUPERSEDED";
export type ConsentDefinitionScope = "TENANT" | "BRANCH" | "OFFERING";
export type ConsentDefinition = { id: string; purpose: ConsentPurpose; title: string; content: string; revision: number; active: boolean; scope: ConsentDefinitionScope; branchId?: string | null; offeringId?: string | null; effectiveUntil?: string | null };
export type ParentConsent = { definition: ConsentDefinition; status: ConsentStatus; decidedAt?: string | null; withdrawnAt?: string | null };
export type ConsentRecord = { definitionId: string; status: ConsentStatus; revision: number; decidedAt?: string | null; withdrawnAt?: string | null };
export type CreateConsentDefinitionInput = { purpose: ConsentPurpose; title: string; content: string; scope?: ConsentDefinitionScope; branchId?: string; offeringId?: string; effectiveUntil?: string };
export type ReviseConsentDefinitionInput = { title: string; content: string; expectedRevision: number };
export type ChildAbsenceRequest = { id: string; childId: string; childName: string; branchId: string; purpose: ChildAbsencePurpose; note?: string | null; startDate: string; endDate: string; status: ChildAbsenceRequestStatus; rejectionReason?: string | null; createdAt: string; decidedAt?: string | null };
export type CreateChildAbsenceRequestInput = { childId: string; purpose: ChildAbsencePurpose; startDate: string; endDate: string; note?: string };
export type DevelopmentEntryMedia = { id: string; kind: "PHOTO" | "AUDIO"; contentType: string; durationMs?: number | null };
export type DevelopmentEntry = {
  id: string;
  childId: string;
  category: string;
  categoryName: string;
  title: string;
  content: string;
  hasPhoto: boolean;
  media: DevelopmentEntryMedia[];
  recordedAt: string;
  recordedBy: string;
};
export type DevelopmentEntryPhotoInput = { contentType: "image/jpeg" | "image/png"; dataBase64: string };
export type DevelopmentEntryMediaContent = { contentType: string; dataBase64: string; durationMs?: number | null };
export type DevelopmentEntryPhoto = { contentType: string; dataBase64: string };
export type ChildHealthRecord = { childId: string; bloodType?: string | null; allergies?: string | null; medicalConditions?: string | null; medications?: string | null; emergencyInstructions?: string | null; updatedByUserId: string; updatedAt: string };
export type UpsertChildHealthRecordInput = { bloodType?: string; allergies?: string; medicalConditions?: string; medications?: string; emergencyInstructions?: string };
export type IncidentSeverity = "MINOR" | "MODERATE" | "SERIOUS";
export type IncidentCategory = "INJURY" | "ILLNESS" | "BEHAVIOR" | "OTHER";
export type ChildIncidentReport = { id: string; childId: string; severity: IncidentSeverity; category: IncidentCategory; description: string; actionTaken?: string | null; occurredAt: string; hasPhoto: boolean; acknowledgedByMe: boolean; createdAt: string };
export type IncidentPhotoInput = { contentType: "image/jpeg" | "image/png"; dataBase64: string };
export type CreateChildIncidentInput = { severity: IncidentSeverity; category: IncidentCategory; description: string; actionTaken?: string; occurredAt: string; photo?: IncidentPhotoInput };
export type ChildIncidentPhoto = { contentType: string; dataBase64: string };
export type BranchOccupancy = { branchId: string; branchName: string; activeChildrenCount: number; dailyCapacity?: number | null };
export type MonthlyParentAttrition = { month: string; deactivatedCount: number };
export type ParentRetention = { currentActiveParents: number; monthly: MonthlyParentAttrition[] };
export type MonthlyDevelopmentTrend = { month: string; goalCount: number; averageYesPercent?: number | null };
export type ServicePlan = { id: string; name: string; type: ServicePlanType; price: number; creditCount?: number; unusedCreditPolicy?: UnusedCreditPolicy; carryForwardDays?: number; bookingRequiresApproval: boolean; dailyCapacity?: number | null };
export type BranchCapacity = { branchId: string; dailyCapacity?: number | null };
export type ServicePlanDiscount = { id: string; planId: string; kind: ServicePlanDiscountKind; name: string; promoCode?: string | null; type: ServicePlanDiscountType; value: number; startsOn?: string | null; endsOn?: string | null; usageLimit?: number | null; active: boolean };
export type CreateServicePlanDiscountInput = Omit<ServicePlanDiscount, "id" | "planId" | "active">;
export type ServicePlanTemplate = { id: string; source: "SYSTEM" | "TENANT"; name: string; type: ServicePlanType; suggestedPrice?: number | null; creditCount?: number | null; unusedCreditPolicy?: UnusedCreditPolicy | null; carryForwardDays?: number | null; bookingRequiresApproval: boolean; dailyCapacity?: number | null };
export type UpsertServicePlanTemplateInput = Omit<ServicePlanTemplate, "id" | "source">;
export type ServiceEntitlement = { id: string; branchId: string; childId: string; childName: string; parentName?: string | null; parentEmail?: string | null; planName: string; type: ServicePlanType; status: "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "EXHAUSTED"; totalCredits?: number | null; remainingCredits?: number | null; validUntil: string };
export type Booking = { id: string; branchId: string; childId: string; childName: string; bookingDate: string; status: BookingStatus; planName: string; invoiceId: string; invoiceNumber: string; invoiceTotalAmount: number };
export type PaymentProofStatus = "SUBMITTED" | "VERIFIED" | "REJECTED";
export type PaymentProof = { status: PaymentProofStatus; fileName: string; note?: string | null; submittedAt: string; rejectionReason?: string | null };
export type PaymentProofImage = { fileName: string; contentType: string; dataBase64: string; note?: string | null };
export type SubmitPaymentProofInput = { fileName: string; contentType: "image/jpeg" | "image/png"; imageBase64: string; note?: string };
export type Invoice = { id: string; invoiceNumber: string; source: "SERVICE" | "OVERTIME" | "PRIVATE_TUTORING"; description?: string | null; branchId: string; childId: string; childName: string; parentName?: string | null; parentEmail?: string | null; subtotalAmount: number; discountAmount: number; discountName?: string | null; discountCode?: string | null; totalAmount: number; status: InvoiceStatus; dueDate: string; createdAt: string; paymentProof?: PaymentProof | null };
export type OperatingDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export type BranchOperatingHour = { dayOfWeek: OperatingDay; active: boolean; opensAt?: string | null; closesAt?: string | null };
export type OvertimeRateTier = { durationMinutes: number; amount: number };
export type BranchOperatingHours = { branchId: string; branchName: string; timezone: string; hours: BranchOperatingHour[]; tiers: OvertimeRateTier[]; autoOvertimeBillingEnabled: boolean; overtimeGraceMinutes: number };
export type UpdateBranchOperatingHoursInput = { hours: BranchOperatingHour[]; tiers: OvertimeRateTier[]; autoOvertimeBillingEnabled: boolean; overtimeGraceMinutes: number };
export type ParentChildOperatingHours = { childId: string; childName: string; organizationId: string; organizationName: string; branchId: string; branchName: string; timezone: string; hours: BranchOperatingHour[]; tiers: OvertimeRateTier[] };
export type CreateOvertimeChargeInput = { childId: string; operationalDate: string; pickedUpAt: string; dueDate: string };
export type OvertimeCharge = { id: string; invoiceId: string; branchId: string; childId: string; childName: string; operationalDate: string; pickedUpAt: string; closesAt: string; overtimeMinutes: number; totalAmount: number; dueDate: string; status: InvoiceStatus; tiers: OvertimeRateTier[] };
export type TenantPayment = { id: string; amount: number; status: TenantPaymentStatus; dueDate: string; paidAt: string | null };
export type TenantStaffAdmin = { id: string; email: string | null; displayName: string | null; status: "ACTIVE" | "INACTIVE" | "PENDING"; primary: boolean };
export type TenantBranch = { id: string; name: string; timezone: string; fullAddress?: string | null; googleMapsUrl?: string | null; active: boolean; primary: boolean };
export type InstitutionTypePresentationInput = { logo?: string | null; backgroundColor?: string | null; borderColor?: string | null; textColor?: string | null };
export type InstitutionTypeParameters = Record<string, string>;
export type InstitutionTypeDefinitionInput = { name: string; description?: string | null; parentOccupationVisible?: boolean; parentIncomeRangeVisible?: boolean; parameters?: InstitutionTypeParameters } & InstitutionTypePresentationInput;
export type InstitutionTypeDefinition = { code: string; name: string; description: string | null; parentOccupationVisible: boolean; parentIncomeRangeVisible: boolean; logo: string | null; backgroundColor: string | null; borderColor: string | null; textColor: string | null; parameters: InstitutionTypeParameters };
export type EducationOffering = { id: string; branchId: string; institutionType: InstitutionType; enrollmentMode: EducationEnrollmentMode; capabilities: InstitutionCapability[]; status: EducationOfferingStatus; programCode: string; revision: number };
export type UiAccessContext = { organizationId: string; role: Role; active: boolean; revision: number; offerings: EducationOffering[] };
export type UpsertEducationOfferingInput = { branchId: string; institutionType: InstitutionType; enrollmentMode: EducationEnrollmentMode; programCode?: string };
export type ParentFamilyProfileForTenant = { husbandOccupation?: ParentOccupation | null; husbandIncomeRange?: ParentIncomeRange | null; wifeOccupation?: ParentOccupation | null; wifeIncomeRange?: ParentIncomeRange | null };
export type Tenant = { id: string; name: string; branchName: string | null; branches: TenantBranch[]; institutionTypes: InstitutionType[]; capabilities: InstitutionCapability[]; subscriptionPlan: TenantSubscriptionPlan | null; subscriptionStatus: TenantSubscriptionStatus | null; periodStart: string | null; periodEnd: string | null; trialEndsAt: string | null; monthlyFee: number | null; staffAdmin: TenantStaffAdmin | null; staffAdmins: TenantStaffAdmin[]; payments: TenantPayment[] };
export type TenantReadinessStatus = "READY" | "NEEDS_ATTENTION";
export type TenantReadinessIssue = "SUBSCRIPTION_NOT_ACTIVE" | "STAFF_ADMIN_REQUIRED" | "ACTIVE_BRANCH_REQUIRED" | "ACTIVE_CLASSROOM_REQUIRED" | "ACTIVE_SERVICE_PLAN_REQUIRED" | "BRANCH_CAPACITY_REQUIRED" | "OPERATING_HOURS_REQUIRED" | "PAYMENT_INSTRUCTION_REQUIRED";
export type TenantReadiness = { tenantId: string; tenantName: string; status: TenantReadinessStatus; issues: TenantReadinessIssue[] };
export type TenantReadinessSummary = { readyCount: number; needsAttentionCount: number; tenants: TenantReadiness[] };
export type CreateTenantInput = { tenantName: string; branchName: string; institutionTypes: InstitutionType[]; subscriptionPlan: TenantSubscriptionPlan; monthlyFee?: number; trialMonths?: number; staffAdminName: string; staffAdminUsername?: string; staffAdminEmail: string; staffAdminPassword: string };
export type UpdateTenantInput = { tenantName: string; institutionTypes: InstitutionType[]; subscriptionPlan: TenantSubscriptionPlan; monthlyFee?: number };
export type CreatePlatformAdminInput = { email: string; username: string; password: string };
export type IdentityCheckResult = { exists: boolean; email: string | null; phoneNumber: string | null };
export type AcademicYear = { id: string; name: string; startsOn: string; endsOn: string; active: boolean };
export type CreateAcademicYearInput = { name: string; startsOn: string; endsOn: string };
export type CurriculumProgram = { id: string; academicYearId?: string | null; name: string; description: string; source: "GLOBAL" | "TENANT"; isTemplate: boolean; active: boolean; developmentProgramIds: string[] };
export type CreateCurriculumProgramInput = { academicYearId?: string; name: string; description: string; developmentProgramIds?: string[] };
export type GlobalCurriculumProgram = Omit<CurriculumProgram, "academicYearId"> & { learningLevelId: string | null };
export type CreateGlobalCurriculumProgramInput = { learningLevelId: string; name: string; description: string; developmentProgramIds?: string[] };
export type CurriculumActivity = { id: string; name: string; description: string; active: boolean };
export type UpsertCurriculumActivityInput = { name: string; description?: string };
export type CurriculumActivityAssessment = { id: string; activityId: string; name: string; description: string };
export type CreateCurriculumActivityAssessmentInput = { name: string; description?: string };
export type LearningLevelTemplate = { code: string; name: string; minAgeMonths?: number | null; maxAgeMonths?: number | null };
export type LearningBranch = { id: string; name: string };
export type LearningLevel = { id: string; name: string; minAgeMonths?: number | null; maxAgeMonths?: number | null; displayOrder: number; source: "GLOBAL" | "TENANT"; isTemplate: boolean; active: boolean; curriculumProgramIds: string[] };
export type UpsertLearningLevelInput = { name: string; minAgeMonths?: number; maxAgeMonths?: number; displayOrder?: number; curriculumProgramIds?: string[] };
export type Classroom = { id: string; branchId: string; learningLevelId?: string | null; learningPeriodId?: string | null; name: string; capacity?: number | null; active: boolean; activeChildren: number };
export type UpsertClassroomInput = { branchId: string; learningLevelId: string; learningPeriodId?: string; name: string; capacity?: number };
export type ClassroomStaffAssignment = { id: string; userId: string; displayName: string; email?: string | null; assignmentRole: ChildAssignmentRole };
export type ClassroomProgram = { id: string; name: string; description: string };
export type GoalIndicator = { id: string; name: string; displayOrder: number; active: boolean; priority: boolean };
export type UpsertGoalIndicatorInput = { name: string; displayOrder?: number; priority?: boolean };
export type DevelopmentProgram = { id: string; learningLevelId: string; name: string; description: string; durationDays: number; minimumYesPercent: number; minimumYesStreak: number; domain: GoalDomain; source: "GLOBAL" | "TENANT"; isTemplate: boolean; active: boolean; revisedFromProgramId?: string | null; revisionNumber: number; indicators: GoalIndicator[]; minAgeMonths?: number | null; maxAgeMonths?: number | null };
export type UpsertDevelopmentProgramInput = Omit<DevelopmentProgram, "id" | "active" | "indicators" | "source" | "isTemplate" | "revisedFromProgramId" | "revisionNumber" | "minAgeMonths" | "maxAgeMonths"> & { indicatorNames?: string[] };
export type GoalIndicatorCheckIn = { indicatorId: string; date: string; outcome: GoalCheckInOutcome; note?: string | null; hasPhoto: boolean; hasAudio: boolean; audioDurationMs?: number | null; recordedAt: string };
export type GoalCheckInPhotoInput = { contentType: "image/jpeg" | "image/png"; dataBase64: string };
export type GoalCheckInAudioInput = { contentType: string; dataBase64: string; durationMs?: number };
export type GoalCheckInBatchInput = { indicatorId: string; outcome: GoalCheckInOutcome };
export type GoalCheckInPhoto = { contentType: string; dataBase64: string };
export type GoalCheckInAudio = { contentType: string; dataBase64: string; durationMs?: number | null };
export type ChildGoalConclusionCorrection = { id: string; previousOutcome: ChildGoalOutcome; previousSummary: string; correctedOutcome: ChildGoalOutcome; correctedSummary: string; reason: string; correctedAt: string };
export type ChildGoal = { id: string; childId: string; curriculumProgramId?: string | null; curriculumProgramName?: string | null; programId: string; name: string; description: string; startsOn: string; targetEndsOn: string; durationDays: number; minimumYesPercent: number; minimumYesStreak: number; status: "ACTIVE" | "COMPLETED"; finalOutcome?: ChildGoalOutcome | null; finalSummary?: string | null; finalizedAt?: string | null; recordedDays: number; yesDays: number; noDays: number; yesPercent?: number | null; currentYesStreak: number; longestYesStreak: number; meetsYesPercent: boolean; meetsYesStreak: boolean; missedDays: number; indicators: GoalIndicator[]; checkIns: GoalIndicatorCheckIn[]; conclusionCorrections: ChildGoalConclusionCorrection[] };
export type ChildPlacement = { id: string; classroomId: string; classroomName: string; learningLevelId?: string | null; learningLevelName?: string | null; learningPeriodId?: string | null; startsOn: string; endedOn?: string | null; ageGuidanceWarning: boolean };
export type TenantInvitationInput = { email?: string; phoneNumber?: string; role: Extract<Role, "STAFF" | "PARENT">; branchId?: string; classroomId?: string };
export type CreateTenantUserInput = { displayName: string; email: string; password: string; role: Extract<Role, "STAFF_ADMIN" | "STAFF">; username?: string; branchId?: string; canManageChildPrograms?: boolean; canManageDevelopmentCategories?: boolean };
export type UpdateTenantUserInput = { displayName: string; email: string; username?: string; branchId: string; canManageChildPrograms: boolean; canManageDevelopmentCategories: boolean };
export type TenantUser = { id: string; userId: string | null; displayName: string | null; username: string | null; email: string | null; role: Extract<Role, "STAFF_ADMIN" | "STAFF" | "PARENT">; status: "ACTIVE" | "INACTIVE" | "PENDING"; branchId: string | null; canManageChildPrograms: boolean; canManageDevelopmentCategories: boolean };
export type DevelopmentCategoryOption = { id: string; name: string; active: boolean; system: boolean };
export type ParentTenantPlan = { id: string; name: string; type: ServicePlanType; price: number; creditCount?: number | null; bookingRequiresApproval: boolean; dailyCapacity?: number | null };
export type ParentTenantCatalog = { organizationId: string; organizationName: string; branches: Array<{ id: string; name: string; dailyCapacity?: number | null; fullAddress?: string | null; googleMapsUrl?: string | null }>; plans: ParentTenantPlan[] };
export type ParentEnrollmentStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type ParentEnrollmentAccessState = "PENDING_APPROVAL" | "PAYMENT_DUE" | "PAYMENT_REVIEW" | "ACTIVE" | "BILLING_LIMITED" | "CLOSED";
export type ParentEnrollmentAllowedAction = "REAPPLY" | "UPLOAD_PAYMENT_PROOF";
export type ParentEnrollment = { id: string; organizationId: string; branchId: string; childId: string; childName: string; invoiceId?: string | null; entitlementId?: string | null; status: ParentEnrollmentStatus; invoiceStatus?: InvoiceStatus | null; planName: string; totalAmount: number; rejectionReason?: string | null; createdAt: string; accessState: ParentEnrollmentAccessState; allowedActions: ParentEnrollmentAllowedAction[]; parentFamilyProfile?: ParentFamilyProfileForTenant | null };
export type ParentChildProfile = { child: Child; branch: { id: string; name: string; fullAddress?: string | null; googleMapsUrl?: string | null }; placement?: { classroomName: string; learningLevelName?: string | null } | null; programs: ParentChildProgram[]; staffAssignments: Array<{ displayName: string; assignmentRole: ChildAssignmentRole }> };
export type ParentEnrollmentCheckoutInput = { organizationId: string; branchId: string; planId: string; bookingDates: string[]; promoCode?: string; children: Array<{ firstName: string; lastName?: string; gender: ChildGender; dateOfBirth: string }> };
export type PrivateTutorType = "STAFF" | "EXTERNAL";
export type PrivateTutoringRequestStatus = "PENDING_APPROVAL" | "PENDING_PAYMENT" | "CONFIRMED" | "REJECTED" | "CANCELLED";
export type PrivateTutor = { id: string; type: PrivateTutorType; staffUserId?: string | null; displayName: string; bio: string; active: boolean };
export type PrivateTutoringService = { id: string; branchId: string; name: string; description: string; minAgeMonths: number; maxAgeMonths: number; durationMinutes: number; dailyPrice: number | null; weeklyPrice: number | null; monthlyPrice: number | null; learningLevelIds: string[]; tutors: PrivateTutor[]; active: boolean };
export type UpsertPrivateTutoringServiceInput = Omit<PrivateTutoringService, "id" | "tutors"> & { tutorIds: string[] };
export type UpsertPrivateTutorInput = { type: PrivateTutorType; staffUserId?: string; displayName?: string; bio?: string; active: boolean };
export type PrivateTutoringRequest = { id: string; childId: string; childName: string; serviceName: string; providerName?: string | null; durationMinutes: number; price: number; pricingType: ServicePlanType; preferredAt?: string | null; scheduledAt?: string | null; note?: string | null; decisionReason?: string | null; status: PrivateTutoringRequestStatus; invoiceId?: string | null; invoiceStatus?: InvoiceStatus | null; createdAt: string };
export type PaymentInstruction = { id: string; name: string; accountHolder: string; accountNumber: string; note?: string | null; active: boolean; displayOrder: number };
export type UpsertPaymentInstructionInput = Omit<PaymentInstruction, "id">;
export type AppNotification = { id: string; title: string; body: string; actionPath?: string | null; createdAt: string; readAt?: string | null };
export type PushNotificationMuteDuration = "ONE_HOUR" | "ONE_WEEK" | "ONE_MONTH";
export type DeviceNotificationPreference = { pushMutedUntil?: string | null };
export type DownloadedReport = { fileName: string; contentType: string; dataBase64: string };
export type StaffReminder = { id: string; title: string; description: string; hour: number; minute: number; weekdays: number[]; target: StaffReminderTarget; active: boolean; ruleVersion: number };
export type UpsertStaffReminderInput = Omit<StaffReminder, "id" | "active" | "ruleVersion">;
export type StaffLeaveEvidenceInput = { contentType: "image/jpeg" | "image/png"; dataBase64: string };
export type CreateStaffLeaveRequestInput = { type: StaffLeaveRequestType; startsOn: string; endsOn: string; reason: string; evidence?: StaffLeaveEvidenceInput };
export type StaffLeaveRequest = { id: string; requesterUserId: string; requesterName: string; type: StaffLeaveRequestType; startsOn: string; endsOn: string; reason: string; status: StaffLeaveRequestStatus; hasEvidence: boolean; rejectionReason?: string | null; reviewedAt?: string | null; createdAt: string };
export type StaffLeaveEvidence = { contentType: string; dataBase64: string };
export type GlobalCurriculumSeedResult = { alreadySeeded: boolean; learningLevelCount: number; developmentProgramCount: number; developmentProgramItemCount: number; curriculumProgramCount: number };
export type RealtimeFlag = "NOTIFICATIONS" | "PROFILE" | "PARENT_ENROLLMENTS" | "CHILDREN" | "ATTENDANCE" | "ABSENCE_REQUESTS" | "INCIDENT_REPORTS" | "DEVELOPMENT" | "DEVELOPMENT_CATEGORIES" | "BOOKINGS" | "INVOICES" | "ENTITLEMENTS" | "SERVICE_PLANS" | "BRANCHES" | "TENANT_USERS" | "LEARNING" | "ACADEMIC" | "TENANTS" | "GLOBAL_CURRICULUM" | "GOALS" | "STAFF_REMINDERS" | "STAFF_LEAVE_REQUESTS" | "PRIVATE_TUTORING";
export type RealtimeEvent<TPayload = unknown> = { type: "EVENT"; id: string; organizationId?: string | null; flags: RealtimeFlag[]; payload?: TPayload | null; occurredAt: string };
export type RealtimeConnectRequest = { type: "CONNECT"; token: string; organizationId?: string | null };

function withBranchFilter(path: string, filter: BranchListFilter) {
  if (!filter.branchId) return path;
  return `${path}?${new URLSearchParams({ branchId: filter.branchId }).toString()}`;
}

function withBranchAndSearchFilter(path: string, filter: BranchListFilter, search?: string) {
  const params: Record<string, string> = {};
  if (filter.branchId) params.branchId = filter.branchId;
  const query = search?.trim();
  if (query) params.search = query;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${path}?${qs}` : path;
}

export function realtimeUrl(apiUrl: string, override?: string): string {
  if (override) return override;
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/realtime`;
  return url.toString();
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async logout(accessToken: string): Promise<void> { await this.request<void>("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }); }

  async me(): Promise<CurrentUser> {
    return this.request("/me");
  }
  async identityCheck(): Promise<IdentityCheckResult> { return this.request("/auth/identity-check"); }
  async updateMyProfile(input: { gender: ChildGender; dateOfBirth: string }): Promise<CurrentUser> { return this.request("/me", { method: "PATCH", body: JSON.stringify(input) }); }
  async updateMyUsername(username?: string): Promise<CurrentUser> { return this.request("/me/username", { method: "PATCH", body: JSON.stringify({ username }) }); }
  async uiAccessContext(): Promise<UiAccessContext> { return this.request("/education-offerings/context"); }
  async educationOfferings(): Promise<EducationOffering[]> { return this.request("/education-offerings"); }
  async createEducationOffering(input: UpsertEducationOfferingInput): Promise<EducationOffering> { return this.request("/education-offerings", { method: "POST", body: JSON.stringify(input) }); }
  async setEducationOfferingStatus(offeringId: string, status: EducationOfferingStatus): Promise<EducationOffering> { return this.request(`/education-offerings/${offeringId}/status`, { method: "POST", body: JSON.stringify({ status }) }); }
  async parentFamilyProfile(): Promise<CurrentUser["parentFamilyProfile"]> { return this.request("/parent-family-profile"); }
  async updateParentFamilyProfile(input: ParentFamilyProfileInput): Promise<NonNullable<CurrentUser["parentFamilyProfile"]>> { return this.request("/parent-family-profile", { method: "PUT", body: JSON.stringify(input) }); }
  async parentEnrollmentCatalog(search?: string): Promise<ParentTenantCatalog[]> { const query = search?.trim(); return this.request(`/parent-enrollment/catalog${query ? `?${new URLSearchParams({ search: query }).toString()}` : ""}`); }
  async parentEnrollments(): Promise<ParentEnrollment[]> { return this.request("/parent-enrollment"); }
  async checkoutParentEnrollment(input: ParentEnrollmentCheckoutInput): Promise<ParentEnrollment[]> { return this.request("/parent-enrollment/checkout", { method: "POST", body: JSON.stringify(input) }); }
  async pendingParentEnrollments(filter: BranchListFilter = {}, search?: string): Promise<ParentEnrollment[]> { return this.request(withBranchAndSearchFilter("/parent-enrollment/pending-approval", filter, search)); }
  async approveParentEnrollment(enrollmentId: string, approved: boolean, rejectionReason?: string): Promise<ParentEnrollment> { return this.request(`/parent-enrollment/${enrollmentId}/approval`, { method: "POST", body: JSON.stringify({ approved, rejectionReason }) }); }
  async retryParentEnrollment(enrollmentId: string, bookingDates: string[]): Promise<ParentEnrollment> { return this.request(`/parent-enrollment/${enrollmentId}/retry`, { method: "POST", body: JSON.stringify({ bookingDates }) }); }
  async cancelParentEnrollment(enrollmentId: string): Promise<ParentEnrollment> { return this.request(`/parent-enrollment/${enrollmentId}/cancel`, { method: "POST" }); }
  async paymentInstructions(organizationId: string): Promise<PaymentInstruction[]> { return this.request("/payment-instructions", { headers: { "X-Organization-Id": organizationId } }); }
  async managedPaymentInstructions(): Promise<PaymentInstruction[]> { return this.request("/payment-instructions/manage"); }
  async createPaymentInstruction(input: UpsertPaymentInstructionInput): Promise<PaymentInstruction> { return this.request("/payment-instructions", { method: "POST", body: JSON.stringify(input) }); }
  async updatePaymentInstruction(instructionId: string, input: UpsertPaymentInstructionInput): Promise<PaymentInstruction> { return this.request(`/payment-instructions/${instructionId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deletePaymentInstruction(instructionId: string): Promise<void> { await this.request<void>(`/payment-instructions/${instructionId}`, { method: "DELETE" }); }
  async privateTutoringServices(): Promise<PrivateTutoringService[]> { return this.request("/private-tutoring/manage/services"); }
  async createPrivateTutoringService(input: UpsertPrivateTutoringServiceInput): Promise<PrivateTutoringService> { return this.request("/private-tutoring/manage/services", { method: "POST", body: JSON.stringify(input) }); }
  async updatePrivateTutoringService(serviceId: string, input: UpsertPrivateTutoringServiceInput): Promise<PrivateTutoringService> { return this.request(`/private-tutoring/manage/services/${serviceId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async privateTutors(): Promise<PrivateTutor[]> { return this.request("/private-tutoring/manage/tutors"); }
  async createPrivateTutor(input: UpsertPrivateTutorInput): Promise<PrivateTutor> { return this.request("/private-tutoring/manage/tutors", { method: "POST", body: JSON.stringify(input) }); }
  async updatePrivateTutor(tutorId: string, input: UpsertPrivateTutorInput): Promise<PrivateTutor> { return this.request(`/private-tutoring/manage/tutors/${tutorId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async privateTutoringRequests(): Promise<PrivateTutoringRequest[]> { return this.request("/private-tutoring/manage/requests"); }
  async decidePrivateTutoringRequest(requestId: string, input: { approved: boolean; tutorId?: string; scheduledAt?: string; rejectionReason?: string }): Promise<PrivateTutoringRequest> { return this.request(`/private-tutoring/manage/requests/${requestId}/decision`, { method: "POST", body: JSON.stringify(input) }); }
  async parentPrivateTutoringServices(childId: string): Promise<PrivateTutoringService[]> { return this.request(`/private-tutoring/parent/services?${new URLSearchParams({ childId }).toString()}`); }
  async parentPrivateTutoringRequests(): Promise<PrivateTutoringRequest[]> { return this.request("/private-tutoring/parent/requests"); }
  async createParentPrivateTutoringRequest(serviceId: string, input: { childId: string; pricingType: ServicePlanType; preferredAt?: string; note?: string }): Promise<PrivateTutoringRequest> { return this.request(`/private-tutoring/parent/services/${serviceId}/requests`, { method: "POST", body: JSON.stringify(input) }); }
  async cancelParentPrivateTutoringRequest(requestId: string): Promise<PrivateTutoringRequest> { return this.request(`/private-tutoring/parent/requests/${requestId}/cancel`, { method: "POST" }); }

  async tenants(search?: string): Promise<Tenant[]> { const query = search?.trim(); return this.request(`/platform/tenants${query ? `?${new URLSearchParams({ search: query }).toString()}` : ""}`); }
  async tenantReadiness(): Promise<TenantReadinessSummary> { return this.request("/platform/tenant-readiness"); }
  async organizationReadiness(): Promise<TenantReadiness> { return this.request("/tenant-readiness"); }
  async institutionTypes(): Promise<InstitutionTypeDefinition[]> { return this.request("/platform/institution-types"); }
  async createInstitutionType(input: InstitutionTypeDefinitionInput): Promise<InstitutionTypeDefinition> { return this.request("/platform/institution-types", { method: "POST", body: JSON.stringify(input) }); }
  async updateInstitutionType(code: string, input: InstitutionTypeDefinitionInput): Promise<InstitutionTypeDefinition> { return this.request(`/platform/institution-types/${code}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteInstitutionType(code: string): Promise<void> { await this.request<void>(`/platform/institution-types/${code}`, { method: "DELETE" }); }
  async tenant(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}`); }
  async createTenant(input: CreateTenantInput): Promise<Tenant> { return this.request("/platform/tenants", { method: "POST", body: JSON.stringify(input) }); }
  async updateTenant(organizationId: string, input: UpdateTenantInput): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async createTenantStaffAdmin(organizationId: string, input: { displayName: string; username?: string; email: string; password: string }): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admins`, { method: "POST", body: JSON.stringify(input) }); }
  async updateTenantStaffAdmin(organizationId: string, membershipId: string, input: { displayName: string }): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admins/${membershipId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async removeTenantStaffAdmin(organizationId: string, membershipId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admins/${membershipId}/remove`, { method: "POST" }); }
  async branches(search?: string): Promise<TenantBranch[]> { const query = search?.trim(); return this.request(`/branches${query ? `?${new URLSearchParams({ search: query }).toString()}` : ""}`); }
  async createBranch(input: { name: string; timezone?: string; fullAddress: string; googleMapsUrl?: string }): Promise<TenantBranch> { return this.request("/branches", { method: "POST", body: JSON.stringify(input) }); }
  async updateBranch(branchId: string, input: { name: string; timezone: string; fullAddress: string; googleMapsUrl?: string }): Promise<TenantBranch> { return this.request(`/branches/${branchId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async parentChildProfile(childId: string): Promise<ParentChildProfile> { return this.request(`/parent/children/${childId}/profile`); }
  async addParentChildProgramFeedback(childId: string, programId: string, note: string): Promise<ChildProgramParentFeedback> { return this.request(`/parent/children/${childId}/programs/${programId}/feedback`, { method: "POST", body: JSON.stringify({ note }) }); }
  async setPrimaryBranch(branchId: string): Promise<TenantBranch> { return this.request(`/branches/${branchId}/primary`, { method: "POST" }); }
  async archiveBranch(branchId: string): Promise<TenantBranch> { return this.request(`/branches/${branchId}/archive`, { method: "POST" }); }
  async branchOperatingHours(branchId: string): Promise<BranchOperatingHours> { return this.request(`/branches/${branchId}/operating-hours`); }
  async updateBranchOperatingHours(branchId: string, input: UpdateBranchOperatingHoursInput): Promise<BranchOperatingHours> { return this.request(`/branches/${branchId}/operating-hours`, { method: "PUT", body: JSON.stringify(input) }); }
  async parentOperatingHours(): Promise<BranchOperatingHours[]> { return this.request("/parent/operating-hours"); }
  async parentOperatingHoursAllTenants(): Promise<ParentChildOperatingHours[]> { return this.request("/parent/operating-hours/all-tenants"); }
  async overtimeCharges(): Promise<OvertimeCharge[]> { return this.request("/overtime-charges"); }
  async createOvertimeCharge(input: CreateOvertimeChargeInput): Promise<OvertimeCharge> { return this.request("/overtime-charges", { method: "POST", body: JSON.stringify(input) }); }
  async updateOvertimeCharge(chargeId: string, input: CreateOvertimeChargeInput): Promise<OvertimeCharge> { return this.request(`/overtime-charges/${chargeId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async voidOvertimeCharge(chargeId: string): Promise<void> { await this.request<void>(`/overtime-charges/${chargeId}/void`, { method: "POST" }); }
  async renewTenantSubscription(organizationId: string, monthlyFee?: number): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/subscription/renew`, { method: "POST", body: JSON.stringify({ monthlyFee }) }); }
  async setTenantSubscriptionStatus(organizationId: string, status: Extract<TenantSubscriptionStatus, "ACTIVE" | "SUSPENDED">): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/subscription/${status}`, { method: "POST" }); }
  async createPlatformAdmin(input: CreatePlatformAdminInput): Promise<{ id: string }> { return this.request("/platform/admins", { method: "POST", body: JSON.stringify(input) }); }
  async changePlatformAdminPin(pin: string): Promise<void> { await this.request<void>("/platform/pin", { method: "POST", body: JSON.stringify({ pin }) }); }
  async globalCurriculumPrograms(includeArchived = false): Promise<GlobalCurriculumProgram[]> { return this.request(`/platform/curriculum-programs${includeArchived ? "?includeArchived=true" : ""}`); }
  async globalDevelopmentPrograms(search?: string): Promise<DevelopmentProgram[]> { const query = search?.trim(); return this.request(`/platform/development-programs${query ? `?${new URLSearchParams({ search: query }).toString()}` : ""}`); }
  async createGlobalDevelopmentProgram(input: UpsertDevelopmentProgramInput): Promise<DevelopmentProgram> { return this.request("/platform/development-programs", { method: "POST", body: JSON.stringify(input) }); }
  async updateGlobalDevelopmentProgram(programId: string, input: UpsertDevelopmentProgramInput): Promise<DevelopmentProgram> { return this.request(`/platform/development-programs/${programId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async reviseGlobalDevelopmentProgram(programId: string, input: UpsertDevelopmentProgramInput): Promise<DevelopmentProgram> { return this.request(`/platform/development-programs/${programId}/revisions`, { method: "POST", body: JSON.stringify(input) }); }
  async deleteGlobalDevelopmentProgram(programId: string): Promise<void> { await this.request<void>(`/platform/development-programs/${programId}`, { method: "DELETE" }); }
  async globalLearningLevels(): Promise<LearningLevel[]> { return this.request("/platform/learning-levels"); }
  async createGlobalLearningLevel(input: UpsertLearningLevelInput): Promise<LearningLevel> { return this.request("/platform/learning-levels", { method: "POST", body: JSON.stringify(input) }); }
  async updateGlobalLearningLevel(levelId: string, input: UpsertLearningLevelInput): Promise<LearningLevel> { return this.request(`/platform/learning-levels/${levelId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteGlobalLearningLevel(levelId: string): Promise<void> { await this.request<void>(`/platform/learning-levels/${levelId}`, { method: "DELETE" }); }
  async createGlobalCurriculumProgram(input: CreateGlobalCurriculumProgramInput): Promise<GlobalCurriculumProgram> { return this.request("/platform/curriculum-programs", { method: "POST", body: JSON.stringify(input) }); }
  async updateGlobalCurriculumProgram(programId: string, input: CreateGlobalCurriculumProgramInput): Promise<GlobalCurriculumProgram> { return this.request(`/platform/curriculum-programs/${programId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async setGlobalCurriculumProgramActive(programId: string, active: boolean): Promise<GlobalCurriculumProgram> { return this.request(`/platform/curriculum-programs/${programId}/active`, { method: "PATCH", body: JSON.stringify({ active }) }); }
  async seedGlobalCurriculum(): Promise<GlobalCurriculumSeedResult> { return this.request("/platform/global-curriculum-seed", { method: "POST" }); }
  async markTenantPaymentPaid(organizationId: string, paymentId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/payments/${paymentId}/mark-paid`, { method: "POST" }); }
  async voidTenantPayment(organizationId: string, paymentId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/payments/${paymentId}/void`, { method: "POST" }); }
  async refreshTenantStaffAdminInvitation(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admin-invitation/refresh`, { method: "POST" }); }
  async cancelTenantStaffAdminInvitation(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admin-invitation/cancel`, { method: "POST" }); }
  async inviteTenantUser(input: TenantInvitationInput): Promise<{ id: string }> { return this.request("/invitations", { method: "POST", body: JSON.stringify(input) }); }
  async createTenantUser(input: CreateTenantUserInput): Promise<TenantUser> { return this.request("/tenant-users", { method: "POST", body: JSON.stringify(input) }); }
  async tenantUsers(filter: BranchListFilter = {}): Promise<TenantUser[]> { return this.request(withBranchFilter("/tenant-users", filter)); }
  async updateTenantUser(userId: string, input: UpdateTenantUserInput): Promise<TenantUser> { return this.request(`/tenant-users/${userId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deactivateTenantUser(userId: string): Promise<void> { await this.request<void>(`/tenant-users/${userId}/deactivate`, { method: "POST" }); }
  async updateTenantUserChildProgramPermission(userId: string, canManageChildPrograms: boolean): Promise<TenantUser> { return this.request(`/tenant-users/${userId}/child-program-permission`, { method: "PATCH", body: JSON.stringify({ canManageChildPrograms }) }); }
  async updateTenantUserDevelopmentCategoryPermission(userId: string, canManageDevelopmentCategories: boolean): Promise<TenantUser> { return this.request(`/tenant-users/${userId}/development-category-permission`, { method: "PATCH", body: JSON.stringify({ canManageDevelopmentCategories }) }); }
  async changeTenantUserPassword(userId: string, password: string): Promise<void> { await this.request<void>(`/tenant-users/${userId}/password`, { method: "POST", body: JSON.stringify({ password }) }); }
  async registerDevice(input: { token: string; platform: "ios" | "android"; installationId: string; timeZone: string }): Promise<void> { await this.request<void>("/device-tokens", { method: "POST", body: JSON.stringify(input) }); }
  async deviceNotificationPreference(installationId: string): Promise<DeviceNotificationPreference> { return this.request(`/device-notification-preference?${new URLSearchParams({ installationId }).toString()}`); }
  async updateDeviceNotificationPreference(input: { installationId: string; muteDuration: PushNotificationMuteDuration | null }): Promise<DeviceNotificationPreference> { return this.request("/device-notification-preference", { method: "PATCH", body: JSON.stringify(input) }); }
  async notifications(search?: string): Promise<AppNotification[]> { const query = search?.trim(); return this.request(`/notifications${query ? `?${new URLSearchParams({ search: query }).toString()}` : ""}`); }
  async markNotificationRead(notificationId: string): Promise<AppNotification> { return this.request(`/notifications/${notificationId}/read`, { method: "PATCH" }); }
  async staffReminders(): Promise<StaffReminder[]> { return this.request("/staff-reminders"); }
  async createStaffReminder(input: UpsertStaffReminderInput): Promise<StaffReminder> { return this.request("/staff-reminders", { method: "POST", body: JSON.stringify(input) }); }
  async updateStaffReminder(reminderId: string, input: UpsertStaffReminderInput): Promise<StaffReminder> { return this.request(`/staff-reminders/${reminderId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async setStaffReminderActive(reminderId: string, active: boolean): Promise<StaffReminder> { return this.request(`/staff-reminders/${reminderId}/active`, { method: "PATCH", body: JSON.stringify({ active }) }); }
  async deleteStaffReminder(reminderId: string): Promise<void> { await this.request<void>(`/staff-reminders/${reminderId}`, { method: "DELETE" }); }
  async syncStaffReminderSchedules(input: { installationId: string; schedules: Array<{ reminderId: string; ruleVersion: number; scheduled: boolean }> }): Promise<void> { await this.request<void>("/staff-reminders/local-schedules", { method: "PUT", body: JSON.stringify(input) }); }
  async staffLeaveRequests(): Promise<StaffLeaveRequest[]> { return this.request("/staff-leave-requests"); }
  async createStaffLeaveRequest(input: CreateStaffLeaveRequestInput): Promise<StaffLeaveRequest> { return this.request("/staff-leave-requests", { method: "POST", body: JSON.stringify(input) }); }
  async cancelStaffLeaveRequest(requestId: string): Promise<StaffLeaveRequest> { return this.request(`/staff-leave-requests/${requestId}/cancel`, { method: "POST" }); }
  async pendingStaffLeaveRequests(): Promise<StaffLeaveRequest[]> { return this.request("/staff-leave-requests/pending-approval"); }
  async decideStaffLeaveRequest(requestId: string, input: { approved: boolean; rejectionReason?: string }): Promise<StaffLeaveRequest> { return this.request(`/staff-leave-requests/${requestId}/approval`, { method: "POST", body: JSON.stringify(input) }); }
  async staffLeaveRequestEvidence(requestId: string): Promise<StaffLeaveEvidence> { return this.request(`/staff-leave-requests/${requestId}/evidence`); }
  async academicYears(): Promise<AcademicYear[]> { return this.request("/academic-years"); }
  async createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> { return this.request("/academic-years", { method: "POST", body: JSON.stringify(input) }); }
  async curriculumPrograms(search?: string, includeArchived = false): Promise<CurriculumProgram[]> {
    const params = new URLSearchParams();
    const query = search?.trim();
    if (query) params.set("search", query);
    if (includeArchived) params.set("includeArchived", "true");
    return this.request(`/curriculum-programs${params.size ? `?${params.toString()}` : ""}`);
  }
  async createCurriculumProgram(input: CreateCurriculumProgramInput): Promise<CurriculumProgram> { return this.request("/curriculum-programs", { method: "POST", body: JSON.stringify(input) }); }
  async updateCurriculumProgram(programId: string, input: CreateCurriculumProgramInput): Promise<CurriculumProgram> { return this.request(`/curriculum-programs/${programId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async setCurriculumProgramActive(programId: string, active: boolean): Promise<CurriculumProgram> { return this.request(`/curriculum-programs/${programId}/active`, { method: "PATCH", body: JSON.stringify({ active }) }); }
  async curriculumActivities(): Promise<CurriculumActivity[]> { return this.request("/curriculum-activities"); }
  async createCurriculumActivity(input: UpsertCurriculumActivityInput): Promise<CurriculumActivity> { return this.request("/curriculum-activities", { method: "POST", body: JSON.stringify(input) }); }
  async updateCurriculumActivity(activityId: string, input: UpsertCurriculumActivityInput): Promise<CurriculumActivity> { return this.request(`/curriculum-activities/${activityId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async archiveCurriculumActivity(activityId: string): Promise<CurriculumActivity> { return this.request(`/curriculum-activities/${activityId}/archive`, { method: "POST" }); }
  async curriculumActivityAssessments(activityId: string): Promise<CurriculumActivityAssessment[]> { return this.request(`/curriculum-activities/${activityId}/assessments`); }
  async createCurriculumActivityAssessment(activityId: string, input: CreateCurriculumActivityAssessmentInput): Promise<CurriculumActivityAssessment> { return this.request(`/curriculum-activities/${activityId}/assessments`, { method: "POST", body: JSON.stringify(input) }); }
  async removeCurriculumActivityAssessment(activityId: string, assessmentId: string): Promise<void> { await this.request<void>(`/curriculum-activities/${activityId}/assessments/${assessmentId}`, { method: "DELETE" }); }
  async learningLevelTemplates(): Promise<LearningLevelTemplate[]> { return this.request("/learning-level-templates"); }
  async learningBranches(): Promise<LearningBranch[]> { return this.request("/learning-branches"); }
  async learningLevels(): Promise<LearningLevel[]> { return this.request("/learning-levels"); }
  async createLearningLevel(input: UpsertLearningLevelInput): Promise<LearningLevel> { return this.request("/learning-levels", { method: "POST", body: JSON.stringify(input) }); }
  async updateLearningLevel(levelId: string, input: UpsertLearningLevelInput): Promise<LearningLevel> { return this.request(`/learning-levels/${levelId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async archiveLearningLevel(levelId: string): Promise<LearningLevel> { return this.request(`/learning-levels/${levelId}/archive`, { method: "POST" }); }
  async classrooms(filter: BranchListFilter = {}): Promise<Classroom[]> { return this.request(withBranchFilter("/classrooms", filter)); }
  async createClassroom(input: UpsertClassroomInput): Promise<Classroom> { return this.request("/classrooms", { method: "POST", body: JSON.stringify(input) }); }
  async updateClassroom(classroomId: string, input: UpsertClassroomInput): Promise<Classroom> { return this.request(`/classrooms/${classroomId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async archiveClassroom(classroomId: string): Promise<Classroom> { return this.request(`/classrooms/${classroomId}/archive`, { method: "POST" }); }
  async classroomStaffAssignments(classroomId: string): Promise<ClassroomStaffAssignment[]> { return this.request(`/classrooms/${classroomId}/staff-assignments`); }
  async assignClassroomStaff(classroomId: string, input: { userId: string; assignmentRole: ChildAssignmentRole }): Promise<ClassroomStaffAssignment> { return this.request(`/classrooms/${classroomId}/staff-assignments`, { method: "POST", body: JSON.stringify(input) }); }
  async unassignClassroomStaff(classroomId: string, assignmentId: string): Promise<void> { await this.request<void>(`/classrooms/${classroomId}/staff-assignments/${assignmentId}`, { method: "DELETE" }); }
  async classroomPrograms(classroomId: string): Promise<ClassroomProgram[]> { return this.request(`/classrooms/${classroomId}/programs`); }
  async createClassroomProgram(classroomId: string, input: { name: string; description?: string }): Promise<ClassroomProgram> { return this.request(`/classrooms/${classroomId}/programs`, { method: "POST", body: JSON.stringify(input) }); }
  async removeClassroomProgram(classroomId: string, programId: string): Promise<void> { await this.request<void>(`/classrooms/${classroomId}/programs/${programId}`, { method: "DELETE" }); }
  async developmentPrograms(search?: string, curriculumProgramId?: string): Promise<DevelopmentProgram[]> { const params = new URLSearchParams(); const query = search?.trim(); if (query) params.set("search", query); if (curriculumProgramId) params.set("curriculumProgramId", curriculumProgramId); return this.request(`/development-programs${params.size ? `?${params.toString()}` : ""}`); }
  async createDevelopmentProgram(input: UpsertDevelopmentProgramInput): Promise<DevelopmentProgram> { return this.request("/development-programs", { method: "POST", body: JSON.stringify(input) }); }
  async updateDevelopmentProgram(programId: string, input: UpsertDevelopmentProgramInput): Promise<DevelopmentProgram> { return this.request(`/development-programs/${programId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteDevelopmentProgram(programId: string): Promise<void> { await this.request<void>(`/development-programs/${programId}`, { method: "DELETE" }); }
  async createGoalIndicator(programId: string, input: UpsertGoalIndicatorInput): Promise<DevelopmentProgram> { return this.request(`/development-programs/${programId}/indicators`, { method: "POST", body: JSON.stringify(input) }); }
  async updateGoalIndicator(programId: string, indicatorId: string, input: UpsertGoalIndicatorInput): Promise<DevelopmentProgram> { return this.request(`/development-programs/${programId}/indicators/${indicatorId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async archiveGoalIndicator(programId: string, indicatorId: string): Promise<DevelopmentProgram> { return this.request(`/development-programs/${programId}/indicators/${indicatorId}/archive`, { method: "POST" }); }
  async childGoals(childId: string): Promise<ChildGoal[]> { return this.request(`/children/${childId}/goals`); }
  async assignChildGoal(childId: string, input: { curriculumProgramId: string; programId: string; startsOn?: string }): Promise<ChildGoal> { return this.request(`/children/${childId}/goals`, { method: "POST", body: JSON.stringify(input) }); }
  async recordGoalCheckIn(goalId: string, date: string, indicatorId: string, outcome: GoalCheckInOutcome, detail?: { note?: string; photo?: GoalCheckInPhotoInput; audio?: GoalCheckInAudioInput }): Promise<ChildGoal> { return this.request(`/child-goals/${goalId}/check-ins/${date}`, { method: "PUT", body: JSON.stringify({ indicatorId, outcome, ...detail }) }); }
  async recordGoalCheckInBatch(goalId: string, date: string, checkIns: GoalCheckInBatchInput[]): Promise<ChildGoal> { return this.request(`/child-goals/${goalId}/check-ins/${date}/batch`, { method: "PUT", body: JSON.stringify({ checkIns }) }); }
  async goalCheckInPhoto(goalId: string, date: string, indicatorId: string): Promise<GoalCheckInPhoto> { return this.request(`/child-goals/${goalId}/check-ins/${date}/${indicatorId}/photo`); }
  async goalCheckInAudio(goalId: string, date: string, indicatorId: string): Promise<GoalCheckInAudio> { return this.request(`/child-goals/${goalId}/check-ins/${date}/${indicatorId}/audio`); }
  async finalizeChildGoal(goalId: string, input: { outcome: ChildGoalOutcome; summary: string }): Promise<ChildGoal> { return this.request(`/child-goals/${goalId}/finalize`, { method: "POST", body: JSON.stringify(input) }); }
  async correctChildGoalConclusion(goalId: string, input: { outcome: ChildGoalOutcome; summary: string; reason: string }): Promise<void> { await this.request<void>(`/child-goals/${goalId}/conclusion-corrections`, { method: "POST", body: JSON.stringify(input) }); }
  async childPlacements(childId: string): Promise<ChildPlacement[]> { return this.request(`/children/${childId}/placements`); }
  async childPlacementOptions(childId: string): Promise<Classroom[]> { return this.request(`/children/${childId}/placement-options`); }
  async placeChild(childId: string, input: { classroomId: string; startsOn?: string }): Promise<ChildPlacement> { return this.request(`/children/${childId}/placements`, { method: "POST", body: JSON.stringify(input) }); }

  async children(filter: ChildListFilter = {}): Promise<Child[]> {
    const params = new URLSearchParams();
    if (filter.branchId) params.set("branchId", filter.branchId);
    if (filter.learningLevelId) params.set("learningLevelId", filter.learningLevelId);
    if (filter.classroomId) params.set("classroomId", filter.classroomId);
    if (filter.guardianStatus) params.set("guardianStatus", filter.guardianStatus);
    const query = params.toString();
    return this.request(`/children${query ? `?${query}` : ""}`);
  }
  async childAbsenceRequests(input: { childId?: string; branchId?: string } = {}): Promise<ChildAbsenceRequest[]> { const params = new URLSearchParams(); if (input.childId) params.set("childId", input.childId); if (input.branchId) params.set("branchId", input.branchId); return this.request(`/child-absence-requests${params.size ? `?${params.toString()}` : ""}`); }
  async createChildAbsenceRequest(input: CreateChildAbsenceRequestInput): Promise<ChildAbsenceRequest> { return this.request("/child-absence-requests", { method: "POST", body: JSON.stringify(input) }); }
  async decideChildAbsenceRequest(requestId: string, input: { approved: boolean; rejectionReason?: string }): Promise<ChildAbsenceRequest> { return this.request(`/child-absence-requests/${requestId}/decision`, { method: "POST", body: JSON.stringify(input) }); }
  async cancelChildAbsenceRequest(requestId: string): Promise<ChildAbsenceRequest> { return this.request(`/child-absence-requests/${requestId}/cancel`, { method: "POST" }); }
  async createChild(input: ChildInput): Promise<Child> { return this.request("/children", { method: "POST", body: JSON.stringify(input) }); }
  async childProfile(childId: string): Promise<ChildProfile> { return this.request(`/children/${childId}`); }
  async updateChild(childId: string, input: UpdateChildInput): Promise<Child> { return this.request(`/children/${childId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deactivateChild(childId: string): Promise<Child> { return this.request(`/children/${childId}/deactivate`, { method: "POST" }); }
  async addChildProgram(childId: string, input: CreateChildProgramInput): Promise<ChildProgram> { return this.request(`/children/${childId}/programs`, { method: "POST", body: JSON.stringify(input) }); }
  async updateChildProgram(childId: string, programId: string, input: UpdateChildProgramInput): Promise<ChildProgram> { return this.request(`/children/${childId}/programs/${programId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async removeChildProgram(childId: string, programId: string): Promise<void> { await this.request<void>(`/children/${childId}/programs/${programId}`, { method: "DELETE" }); }
  async addChildProgramStep(childId: string, programId: string, input: CreateChildProgramStepInput): Promise<ChildProgramStep> { return this.request(`/children/${childId}/programs/${programId}/steps`, { method: "POST", body: JSON.stringify(input) }); }
  async updateChildProgramStep(childId: string, programId: string, stepId: string, input: UpdateChildProgramStepInput): Promise<ChildProgramStep> { return this.request(`/children/${childId}/programs/${programId}/steps/${stepId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async removeChildProgramStep(childId: string, programId: string, stepId: string): Promise<void> { await this.request<void>(`/children/${childId}/programs/${programId}/steps/${stepId}`, { method: "DELETE" }); }
  async addChildProgramStaffNote(childId: string, programId: string, input: { note: string; stepId?: string }): Promise<ChildProgramStaffNote> { return this.request(`/children/${childId}/programs/${programId}/staff-notes`, { method: "POST", body: JSON.stringify(input) }); }
  async assignChildStaff(childId: string, input: { userId: string; assignmentRole: ChildAssignmentRole }): Promise<ChildStaffAssignment> { return this.request(`/children/${childId}/staff-assignments`, { method: "POST", body: JSON.stringify(input) }); }
  async unassignChildStaff(childId: string, assignmentId: string): Promise<void> { await this.request<void>(`/children/${childId}/staff-assignments/${assignmentId}`, { method: "DELETE" }); }
  async bindChildGuardian(childId: string, identifier: string): Promise<ChildGuardian> { return this.request(`/children/${childId}/guardians`, { method: "POST", body: JSON.stringify({ identifier }) }); }
  async unbindChildGuardian(childId: string, userId: string): Promise<void> { await this.request<void>(`/children/${childId}/guardians/${userId}`, { method: "DELETE" }); }

  async recordAttendance(childId: string, command: { action: AttendanceAction; method: AttendanceMethod; idempotencyKey: string; qrToken?: string; note?: string; at?: string; pickupAuthorizationId?: string; pickupExceptionReason?: string }): Promise<Attendance> {
    return this.request(`/children/${childId}/attendance`, { method: "POST", body: JSON.stringify(command) });
  }

  async pickupAuthorizations(childId: string): Promise<PickupAuthorization[]> { return this.request(`/children/${childId}/pickup-authorizations`); }
  async createPickupAuthorization(childId: string, input: CreatePickupAuthorizationInput): Promise<PickupAuthorization> { return this.request(`/children/${childId}/pickup-authorizations`, { method: "POST", body: JSON.stringify(input) }); }
  async activatePickupAuthorization(childId: string, authorizationId: string): Promise<PickupAuthorization> { return this.request(`/children/${childId}/pickup-authorizations/${authorizationId}/activate`, { method: "POST" }); }
  async revokePickupAuthorization(childId: string, authorizationId: string, reason: string): Promise<PickupAuthorization> { return this.request(`/children/${childId}/pickup-authorizations/${authorizationId}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }); }
  async emergencyContacts(childId: string): Promise<EmergencyContact[]> { return this.request(`/children/${childId}/emergency-contacts`); }
  async createEmergencyContact(childId: string, input: CreateEmergencyContactInput): Promise<EmergencyContact> { return this.request(`/children/${childId}/emergency-contacts`, { method: "POST", body: JSON.stringify(input) }); }
  async removeEmergencyContact(childId: string, contactId: string): Promise<void> { await this.request<void>(`/children/${childId}/emergency-contacts/${contactId}`, { method: "DELETE" }); }
  async revokeEmergencyContact(childId: string, contactId: string, reason: string): Promise<EmergencyContact> { return this.request(`/children/${childId}/emergency-contacts/${contactId}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }); }
  async consentDefinitions(): Promise<ConsentDefinition[]> { return this.request("/consent-definitions"); }
  async managedConsentDefinitions(): Promise<ConsentDefinition[]> { return this.request("/consent-definitions/manage"); }
  async createConsentDefinition(input: CreateConsentDefinitionInput): Promise<ConsentDefinition> { return this.request("/consent-definitions", { method: "POST", body: JSON.stringify(input) }); }
  async reviseConsentDefinition(definitionId: string, input: ReviseConsentDefinitionInput): Promise<ConsentDefinition> { return this.request(`/consent-definitions/${definitionId}`, { method: "PUT", body: JSON.stringify(input) }); }
  async setConsentDefinitionActive(definitionId: string, active: boolean, expectedRevision: number): Promise<ConsentDefinition> { return this.request(`/consent-definitions/${definitionId}/active`, { method: "POST", body: JSON.stringify({ active, expectedRevision }) }); }
  async childConsents(childId: string): Promise<ParentConsent[]> { return this.request(`/children/${childId}/consents`); }
  async decideConsent(childId: string, definitionId: string, granted: boolean): Promise<ConsentRecord> { return this.request(`/children/${childId}/consents`, { method: "POST", body: JSON.stringify({ definitionId, granted }) }); }
  async withdrawConsent(childId: string, definitionId: string): Promise<ConsentRecord> { return this.request(`/children/${childId}/consents/${definitionId}/withdraw`, { method: "POST" }); }

  async issueAttendanceQr(childId: string): Promise<{ token: string; expiresAt: string }> {
    return this.request(`/children/${childId}/attendance-qr`);
  }

  async developmentEntries(childId: string): Promise<DevelopmentEntry[]> {
    return this.request(`/children/${childId}/development-entries`);
  }

  async developmentEntryPhoto(childId: string, entryId: string): Promise<DevelopmentEntryPhoto> {
    return this.request(`/children/${childId}/development-entries/${entryId}/photo`);
  }

  async developmentEntryMedia(childId: string, entryId: string, mediaId: string): Promise<DevelopmentEntryMediaContent> {
    return this.request(`/children/${childId}/development-entries/${entryId}/media/${mediaId}`);
  }

  async childHealthRecord(childId: string): Promise<ChildHealthRecord | null> {
    return this.request(`/children/${childId}/health-record`);
  }

  async upsertChildHealthRecord(childId: string, input: UpsertChildHealthRecordInput): Promise<ChildHealthRecord> {
    return this.request(`/children/${childId}/health-record`, { method: "PUT", body: JSON.stringify(input) });
  }

  async childIncidentReports(childId: string): Promise<ChildIncidentReport[]> {
    return this.request(`/children/${childId}/incident-reports`);
  }

  async createChildIncidentReport(childId: string, input: CreateChildIncidentInput): Promise<ChildIncidentReport> {
    return this.request(`/children/${childId}/incident-reports`, { method: "POST", body: JSON.stringify(input) });
  }

  async acknowledgeChildIncidentReport(childId: string, incidentId: string): Promise<ChildIncidentReport> {
    return this.request(`/children/${childId}/incident-reports/${incidentId}/acknowledge`, { method: "POST" });
  }

  async childIncidentReportPhoto(childId: string, incidentId: string): Promise<ChildIncidentPhoto> {
    return this.request(`/children/${childId}/incident-reports/${incidentId}/photo`);
  }

  async analyticsOccupancy(): Promise<BranchOccupancy[]> { return this.request("/analytics/occupancy"); }
  async analyticsParentRetention(monthsBack?: number): Promise<ParentRetention> { return this.request(`/analytics/parent-retention${monthsBack ? `?monthsBack=${monthsBack}` : ""}`); }
  async analyticsDevelopmentTrend(monthsBack?: number): Promise<MonthlyDevelopmentTrend[]> { return this.request(`/analytics/development-trend${monthsBack ? `?monthsBack=${monthsBack}` : ""}`); }

  async developmentCategories(): Promise<DevelopmentCategoryOption[]> { return this.request("/development-categories"); }
  async createDevelopmentCategory(input: { name: string }): Promise<DevelopmentCategoryOption> { return this.request("/development-categories", { method: "POST", body: JSON.stringify(input) }); }
  async updateDevelopmentCategory(categoryId: string, input: { name?: string; active?: boolean }): Promise<DevelopmentCategoryOption> { return this.request(`/development-categories/${categoryId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteDevelopmentCategory(categoryId: string): Promise<void> { await this.request<void>(`/development-categories/${categoryId}`, { method: "DELETE" }); }
  async globalDevelopmentCategories(): Promise<DevelopmentCategoryOption[]> { return this.request("/platform/development-categories"); }
  async createGlobalDevelopmentCategory(input: { name: string }): Promise<DevelopmentCategoryOption> { return this.request("/platform/development-categories", { method: "POST", body: JSON.stringify(input) }); }
  async updateGlobalDevelopmentCategory(categoryId: string, input: { name?: string; active?: boolean }): Promise<DevelopmentCategoryOption> { return this.request(`/platform/development-categories/${categoryId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteGlobalDevelopmentCategory(categoryId: string): Promise<void> { await this.request<void>(`/platform/development-categories/${categoryId}`, { method: "DELETE" }); }

  async downloadChildrenReport(format: "PDF" | "XLSX", filter: ChildListFilter = {}): Promise<DownloadedReport> {
    const params = new URLSearchParams({ format });
    if (filter.branchId) params.set("branchId", filter.branchId);
    if (filter.learningLevelId) params.set("learningLevelId", filter.learningLevelId);
    if (filter.classroomId) params.set("classroomId", filter.classroomId);
    if (filter.guardianStatus) params.set("guardianStatus", filter.guardianStatus);
    return this.requestFile(`/reports/children/export?${params.toString()}`);
  }

  async downloadChildAttendanceReport(format: "PDF" | "XLSX", filter: ChildAttendanceReportFilter): Promise<DownloadedReport> {
    const params = new URLSearchParams({ format, branchId: filter.branchId, startsOn: filter.startsOn, endsOn: filter.endsOn });
    return this.requestFile(`/reports/children/attendance/export?${params.toString()}`);
  }

  async createDevelopmentEntry(childId: string, input: DevelopmentEntryInput): Promise<DevelopmentEntry> {
    return this.request(`/children/${childId}/development-entries`, { method: "POST", body: JSON.stringify(input) });
  }

  async servicePlans(): Promise<ServicePlan[]> { return this.request("/service-plans"); }
  async createServicePlan(input: Omit<ServicePlan, "id">): Promise<ServicePlan> { return this.request("/service-plans", { method: "POST", body: JSON.stringify(input) }); }
  async branchCapacities(): Promise<BranchCapacity[]> { return this.request("/branch-capacities"); }
  async setBranchCapacity(branchId: string, dailyCapacity: number): Promise<BranchCapacity> { return this.request(`/branches/${branchId}/capacity`, { method: "PUT", body: JSON.stringify({ dailyCapacity }) }); }
  async servicePlanDiscounts(planId: string): Promise<ServicePlanDiscount[]> { return this.request(`/service-plans/${planId}/discounts`); }
  async createServicePlanDiscount(planId: string, input: CreateServicePlanDiscountInput): Promise<ServicePlanDiscount> { return this.request(`/service-plans/${planId}/discounts`, { method: "POST", body: JSON.stringify(input) }); }
  async deactivateServicePlanDiscount(planId: string, discountId: string): Promise<ServicePlanDiscount> { return this.request(`/service-plans/${planId}/discounts/${discountId}/deactivate`, { method: "POST" }); }
  async servicePlanTemplates(): Promise<ServicePlanTemplate[]> { return this.request("/service-plan-templates"); }
  async createServicePlanTemplate(input: UpsertServicePlanTemplateInput): Promise<ServicePlanTemplate> { return this.request("/service-plan-templates", { method: "POST", body: JSON.stringify(input) }); }
  async updateServicePlanTemplate(templateId: string, input: UpsertServicePlanTemplateInput): Promise<ServicePlanTemplate> { return this.request(`/service-plan-templates/${templateId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteServicePlanTemplate(templateId: string): Promise<void> { await this.request<void>(`/service-plan-templates/${templateId}`, { method: "DELETE" }); }
  async purchaseService(input: PurchaseServiceInput): Promise<{ entitlement: ServiceEntitlement; invoice: Invoice; bookings: Booking[] }> { return this.request("/service-purchases", { method: "POST", body: JSON.stringify(input) }); }
  async entitlements(filter: BranchListFilter = {}): Promise<ServiceEntitlement[]> { return this.request(withBranchFilter("/service-entitlements", filter)); }
  async bookEntitlement(entitlementId: string, bookingDates: string[]): Promise<Booking[]> { return this.request(`/service-entitlements/${entitlementId}/bookings`, { method: "POST", body: JSON.stringify({ bookingDates }) }); }
  async bookings(filter: BranchListFilter = {}): Promise<Booking[]> { return this.request(withBranchFilter("/bookings", filter)); }
  async pendingBookings(filter: BranchListFilter = {}, search?: string): Promise<Booking[]> { return this.request(withBranchAndSearchFilter("/bookings/pending-approval", filter, search)); }
  async approveBooking(bookingId: string, approved: boolean): Promise<Booking> { return this.request(`/bookings/${bookingId}/approval`, { method: "POST", body: JSON.stringify({ approved }) }); }
  async invoices(filter: BranchListFilter = {}, search?: string): Promise<Invoice[]> { return this.request(withBranchAndSearchFilter("/invoices", filter, search)); }
  async invoice(invoiceId: string): Promise<Invoice> { return this.request(`/invoices/${invoiceId}`); }
  async submitPaymentProof(invoiceId: string, input: SubmitPaymentProofInput): Promise<Invoice> { return this.request(`/invoices/${invoiceId}/payment-proof`, { method: "POST", body: JSON.stringify(input) }); }
  async paymentProof(invoiceId: string): Promise<PaymentProofImage> { return this.request(`/invoices/${invoiceId}/payment-proof`); }
  async reviewPaymentProof(invoiceId: string, approved: boolean, rejectionReason?: string): Promise<Invoice> { return this.request(`/invoices/${invoiceId}/payment-proof/review`, { method: "POST", body: JSON.stringify({ approved, rejectionReason }) }); }
  async markInvoicePaid(invoiceId: string): Promise<Invoice> { return this.request(`/invoices/${invoiceId}/mark-paid`, { method: "POST" }); }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.authorizedFetch(path, init);
    if (!response.ok) throw await this.responseError(response);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async requestFile(path: string): Promise<DownloadedReport> {
    const response = await this.authorizedFetch(path, { headers: { Accept: "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    if (!response.ok) throw await this.responseError(response);
    const contentType = response.headers.get("Content-Type") ?? "application/octet-stream";
    const fileName = fileNameFromDisposition(response.headers.get("Content-Disposition")) ?? "report";
    return { fileName, contentType, dataBase64: arrayBufferToBase64(await response.arrayBuffer()) };
  }

  private async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.options.getToken();
    const organizationId = this.options.getOrganizationId();
    const method = init.method ?? "GET";
    const url = `${this.options.baseUrl}${path}`;
    const startedAt = Date.now();
    this.logRequest({ phase: "REQUEST", method, url });
    try {
      const response = await fetchWithTimeout(url, {
        ...init,
        headers: {
          Accept: "application/json",
          "Accept-Language": this.options.getLanguage(),
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(organizationId ? { "X-Organization-Id": organizationId } : {}),
          ...init.headers,
        },
      });
      this.logRequest({ phase: "RESPONSE", method, url, status: response.status, durationMs: Date.now() - startedAt });
      return response;
    } catch (error) {
      if (isApiTimeoutError(error)) {
        this.logRequest({ phase: "FAILURE", method, url, durationMs: Date.now() - startedAt, failure: "TIMEOUT" });
        throw error;
      }
      this.logRequest({ phase: "FAILURE", method, url, durationMs: Date.now() - startedAt, failure: "NETWORK" });
      throw new ApiNetworkError();
    }
  }

  private logRequest(entry: ApiRequestLogEntry) {
    try {
      this.options.onRequestLog?.(entry);
    } catch {
      // Local diagnostic logging must never affect API behavior.
    }
  }

  private async responseError(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
    return new ApiError(response.status, body.code ?? "UNKNOWN", body.detail ?? "Request failed");
  }
}

function fileNameFromDisposition(value: string | null): string | null {
  const match = value?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

function arrayBufferToBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return globalThis.btoa(binary);
}
