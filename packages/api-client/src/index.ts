import type { AttendanceAction, AttendanceMethod, BookingStatus, ChildGender, ChildGoalOutcome, ChildInput, CurrentUser, DevelopmentEntryInput, GoalCheckInOutcome, InstitutionCapability, InstitutionType, InvoiceStatus, PurchaseServiceInput, Role, ServicePlanDiscountKind, ServicePlanDiscountType, ServicePlanType, StaffReminderTarget, TenantPaymentStatus, TenantSubscriptionPlan, TenantSubscriptionStatus, UnusedCreditPolicy } from "@daycare/core";

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
};

export type Child = Omit<ChildInput, "gender"> & { id: string; fullName: string; organizationId: string; branchId: string; gender: ChildGender | "UNSPECIFIED"; todayCheckedInAt?: string | null; todayCheckedOutAt?: string | null };
export type BranchListFilter = { branchId?: string };
export type ChildListFilter = { branchId?: string; learningLevelId?: string; classroomId?: string };
export type UpdateChildInput = Omit<ChildInput, "classroomId">;
export type ChildProgram = { id: string; name: string; description: string };
export type ChildAssignmentRole = "STAFF" | "NURSE" | "MISS";
export type ChildStaffAssignment = { id: string; userId: string; displayName: string; email?: string | null; assignmentRole: ChildAssignmentRole };
export type ChildProfile = { child: Child; programs: ChildProgram[]; staffAssignments: ChildStaffAssignment[] };
export type Attendance = {
  id: string;
  childId: string;
  operationalDate: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  method: AttendanceMethod;
};
export type DevelopmentEntry = {
  id: string;
  childId: string;
  category: string;
  categoryName: string;
  title: string;
  content: string;
  recordedAt: string;
  recordedBy: string;
};
export type ServicePlan = { id: string; name: string; type: ServicePlanType; price: number; creditCount?: number; unusedCreditPolicy?: UnusedCreditPolicy; carryForwardDays?: number; bookingRequiresApproval: boolean; dailyCapacity?: number | null };
export type BranchCapacity = { branchId: string; dailyCapacity?: number | null };
export type ServicePlanDiscount = { id: string; planId: string; kind: ServicePlanDiscountKind; name: string; promoCode?: string | null; type: ServicePlanDiscountType; value: number; startsOn?: string | null; endsOn?: string | null; usageLimit?: number | null; active: boolean };
export type CreateServicePlanDiscountInput = Omit<ServicePlanDiscount, "id" | "planId" | "active">;
export type ServicePlanTemplate = { id: string; source: "SYSTEM" | "TENANT"; name: string; type: ServicePlanType; suggestedPrice?: number | null; creditCount?: number | null; unusedCreditPolicy?: UnusedCreditPolicy | null; carryForwardDays?: number | null; bookingRequiresApproval: boolean; dailyCapacity?: number | null };
export type UpsertServicePlanTemplateInput = Omit<ServicePlanTemplate, "id" | "source">;
export type ServiceEntitlement = { id: string; branchId: string; childId: string; childName: string; parentName?: string | null; parentEmail?: string | null; planName: string; type: ServicePlanType; status: "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "EXHAUSTED"; totalCredits?: number | null; remainingCredits?: number | null; validUntil: string };
export type Booking = { id: string; branchId: string; childId: string; childName: string; bookingDate: string; status: BookingStatus; planName: string; invoiceId: string };
export type PaymentProofStatus = "SUBMITTED" | "VERIFIED" | "REJECTED";
export type PaymentProof = { status: PaymentProofStatus; fileName: string; note?: string | null; submittedAt: string; rejectionReason?: string | null };
export type PaymentProofImage = { fileName: string; contentType: string; dataBase64: string; note?: string | null };
export type SubmitPaymentProofInput = { fileName: string; contentType: "image/jpeg" | "image/png"; imageBase64: string; note?: string };
export type Invoice = { id: string; invoiceNumber: string; branchId: string; childId: string; childName: string; parentName?: string | null; parentEmail?: string | null; subtotalAmount: number; discountAmount: number; discountName?: string | null; discountCode?: string | null; totalAmount: number; status: InvoiceStatus; dueDate: string; createdAt: string; paymentProof?: PaymentProof | null };
export type TenantPayment = { id: string; amount: number; status: TenantPaymentStatus; dueDate: string; paidAt: string | null };
export type TenantStaffAdmin = { id: string; email: string | null; displayName: string | null; status: "ACTIVE" | "INACTIVE" | "PENDING"; primary: boolean };
export type TenantBranch = { id: string; name: string; timezone: string; active: boolean; primary: boolean };
export type InstitutionTypeDefinition = { code: string; name: string };
export type Tenant = { id: string; name: string; branchName: string | null; branches: TenantBranch[]; institutionTypes: InstitutionType[]; capabilities: InstitutionCapability[]; subscriptionPlan: TenantSubscriptionPlan | null; subscriptionStatus: TenantSubscriptionStatus | null; periodStart: string | null; periodEnd: string | null; trialEndsAt: string | null; monthlyFee: number | null; staffAdmin: TenantStaffAdmin | null; staffAdmins: TenantStaffAdmin[]; payments: TenantPayment[] };
export type CreateTenantInput = { tenantName: string; branchName: string; institutionTypes: InstitutionType[]; subscriptionPlan: TenantSubscriptionPlan; monthlyFee?: number; trialMonths?: number; staffAdminName: string; staffAdminEmail: string; staffAdminPassword: string };
export type UpdateTenantInput = { tenantName: string; institutionTypes: InstitutionType[]; subscriptionPlan: TenantSubscriptionPlan; monthlyFee?: number };
export type CreatePlatformAdminInput = { email: string; username: string; password: string };
export type AcademicYear = { id: string; name: string; startsOn: string; endsOn: string; active: boolean };
export type CreateAcademicYearInput = { name: string; startsOn: string; endsOn: string };
export type CurriculumProgram = { id: string; academicYearId?: string | null; name: string; description: string; source: "GLOBAL" | "TENANT" };
export type CreateCurriculumProgramInput = { academicYearId?: string; name: string; description: string };
export type CurriculumActivity = { id: string; name: string; description: string; active: boolean };
export type UpsertCurriculumActivityInput = { name: string; description?: string };
export type CurriculumActivityAssessment = { id: string; activityId: string; name: string; description: string };
export type CreateCurriculumActivityAssessmentInput = { name: string; description?: string };
export type LearningLevelTemplate = { code: string; name: string; minAgeMonths?: number | null; maxAgeMonths?: number | null };
export type LearningBranch = { id: string; name: string };
export type LearningLevel = { id: string; name: string; minAgeMonths?: number | null; maxAgeMonths?: number | null; displayOrder: number; active: boolean; curriculumProgramIds: string[] };
export type UpsertLearningLevelInput = { name: string; minAgeMonths?: number; maxAgeMonths?: number; displayOrder?: number; curriculumProgramIds?: string[] };
export type Classroom = { id: string; branchId: string; learningLevelId?: string | null; learningPeriodId?: string | null; name: string; capacity?: number | null; active: boolean; activeChildren: number };
export type UpsertClassroomInput = { branchId: string; learningLevelId: string; learningPeriodId?: string; name: string; capacity?: number };
export type ClassroomStaffAssignment = { id: string; userId: string; displayName: string; email?: string | null; assignmentRole: ChildAssignmentRole };
export type ClassroomProgram = { id: string; name: string; description: string };
export type GoalIndicator = { id: string; name: string; displayOrder: number; active: boolean };
export type UpsertGoalIndicatorInput = { name: string; displayOrder?: number };
export type GoalTemplate = { id: string; learningLevelId?: string | null; classroomId?: string | null; name: string; description: string; durationDays: number; minimumYesPercent: number; minimumYesStreak: number; active: boolean; indicators: GoalIndicator[] };
export type UpsertGoalTemplateInput = Omit<GoalTemplate, "id" | "active" | "indicators">;
export type GoalIndicatorCheckIn = { indicatorId: string; date: string; outcome: GoalCheckInOutcome; recordedAt: string };
export type ChildGoal = { id: string; childId: string; templateId: string; name: string; description: string; startsOn: string; targetEndsOn: string; durationDays: number; minimumYesPercent: number; minimumYesStreak: number; status: "ACTIVE" | "COMPLETED"; finalOutcome?: ChildGoalOutcome | null; finalSummary?: string | null; finalizedAt?: string | null; recordedDays: number; yesDays: number; noDays: number; yesPercent?: number | null; currentYesStreak: number; longestYesStreak: number; meetsYesPercent: boolean; meetsYesStreak: boolean; indicators: GoalIndicator[]; checkIns: GoalIndicatorCheckIn[] };
export type ChildPlacement = { id: string; classroomId: string; classroomName: string; learningLevelId?: string | null; learningLevelName?: string | null; learningPeriodId?: string | null; startsOn: string; endedOn?: string | null; ageGuidanceWarning: boolean };
export type TenantInvitationInput = { email?: string; phoneNumber?: string; role: Extract<Role, "STAFF" | "PARENT">; branchId?: string; classroomId?: string };
export type CreateTenantUserInput = { displayName: string; email: string; password: string; role: Extract<Role, "STAFF_ADMIN" | "STAFF">; branchId?: string; canManageChildPrograms?: boolean; canManageDevelopmentCategories?: boolean };
export type TenantUser = { id: string; userId: string | null; displayName: string | null; email: string | null; role: Extract<Role, "STAFF_ADMIN" | "STAFF" | "PARENT">; status: "ACTIVE" | "INACTIVE" | "PENDING"; branchId: string | null; canManageChildPrograms: boolean; canManageDevelopmentCategories: boolean };
export type DevelopmentCategoryOption = { id: string; name: string; active: boolean; system: boolean };
export type ParentTenantPlan = { id: string; name: string; type: ServicePlanType; price: number; creditCount?: number | null; bookingRequiresApproval: boolean; dailyCapacity?: number | null };
export type ParentTenantCatalog = { organizationId: string; organizationName: string; branches: Array<{ id: string; name: string; dailyCapacity?: number | null }>; plans: ParentTenantPlan[] };
export type ParentEnrollmentStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type ParentEnrollment = { id: string; organizationId: string; branchId: string; childId: string; childName: string; invoiceId?: string | null; entitlementId?: string | null; status: ParentEnrollmentStatus; invoiceStatus?: InvoiceStatus | null; planName: string; totalAmount: number; rejectionReason?: string | null; createdAt: string };
export type ParentEnrollmentCheckoutInput = { organizationId: string; branchId: string; planId: string; bookingDates: string[]; promoCode?: string; children: Array<{ firstName: string; lastName?: string; gender: ChildGender; dateOfBirth: string }> };
export type PaymentInstruction = { id: string; name: string; accountHolder: string; accountNumber: string; note?: string | null; active: boolean; displayOrder: number };
export type UpsertPaymentInstructionInput = Omit<PaymentInstruction, "id">;
export type AppNotification = { id: string; title: string; body: string; actionPath?: string | null; createdAt: string; readAt?: string | null };
export type PushNotificationMuteDuration = "ONE_HOUR" | "ONE_WEEK" | "ONE_MONTH";
export type DeviceNotificationPreference = { pushMutedUntil?: string | null };
export type DownloadedReport = { fileName: string; contentType: string; dataBase64: string };
export type StaffReminder = { id: string; title: string; description: string; hour: number; minute: number; weekdays: number[]; target: StaffReminderTarget; active: boolean; ruleVersion: number };
export type UpsertStaffReminderInput = Omit<StaffReminder, "id" | "active" | "ruleVersion">;
export type RealtimeFlag = "NOTIFICATIONS" | "PROFILE" | "PARENT_ENROLLMENTS" | "CHILDREN" | "ATTENDANCE" | "DEVELOPMENT" | "DEVELOPMENT_CATEGORIES" | "BOOKINGS" | "INVOICES" | "ENTITLEMENTS" | "SERVICE_PLANS" | "BRANCHES" | "TENANT_USERS" | "LEARNING" | "ACADEMIC" | "TENANTS" | "GLOBAL_CURRICULUM" | "GOALS" | "STAFF_REMINDERS";
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

  async me(): Promise<CurrentUser> {
    return this.request("/me");
  }
  async updateMyProfile(input: { gender: ChildGender; dateOfBirth: string }): Promise<CurrentUser> { return this.request("/me", { method: "PATCH", body: JSON.stringify(input) }); }
  async parentEnrollmentCatalog(): Promise<ParentTenantCatalog[]> { return this.request("/parent-enrollment/catalog"); }
  async parentEnrollments(): Promise<ParentEnrollment[]> { return this.request("/parent-enrollment"); }
  async checkoutParentEnrollment(input: ParentEnrollmentCheckoutInput): Promise<ParentEnrollment[]> { return this.request("/parent-enrollment/checkout", { method: "POST", body: JSON.stringify(input) }); }
  async pendingParentEnrollments(filter: BranchListFilter = {}, search?: string): Promise<ParentEnrollment[]> { return this.request(withBranchAndSearchFilter("/parent-enrollment/pending-approval", filter, search)); }
  async approveParentEnrollment(enrollmentId: string, approved: boolean, rejectionReason?: string): Promise<ParentEnrollment> { return this.request(`/parent-enrollment/${enrollmentId}/approval`, { method: "POST", body: JSON.stringify({ approved, rejectionReason }) }); }
  async retryParentEnrollment(enrollmentId: string, bookingDates: string[]): Promise<ParentEnrollment> { return this.request(`/parent-enrollment/${enrollmentId}/retry`, { method: "POST", body: JSON.stringify({ bookingDates }) }); }
  async cancelParentEnrollment(enrollmentId: string): Promise<ParentEnrollment> { return this.request(`/parent-enrollment/${enrollmentId}/cancel`, { method: "POST" }); }
  async paymentInstructions(): Promise<PaymentInstruction[]> { return this.request("/payment-instructions"); }
  async managedPaymentInstructions(): Promise<PaymentInstruction[]> { return this.request("/payment-instructions/manage"); }
  async createPaymentInstruction(input: UpsertPaymentInstructionInput): Promise<PaymentInstruction> { return this.request("/payment-instructions", { method: "POST", body: JSON.stringify(input) }); }
  async updatePaymentInstruction(instructionId: string, input: UpsertPaymentInstructionInput): Promise<PaymentInstruction> { return this.request(`/payment-instructions/${instructionId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deletePaymentInstruction(instructionId: string): Promise<void> { await this.request<void>(`/payment-instructions/${instructionId}`, { method: "DELETE" }); }

  async tenants(search?: string): Promise<Tenant[]> { const query = search?.trim(); return this.request(`/platform/tenants${query ? `?${new URLSearchParams({ search: query }).toString()}` : ""}`); }
  async institutionTypes(): Promise<InstitutionTypeDefinition[]> { return this.request("/platform/institution-types"); }
  async createInstitutionType(input: { name: string }): Promise<InstitutionTypeDefinition> { return this.request("/platform/institution-types", { method: "POST", body: JSON.stringify(input) }); }
  async updateInstitutionType(code: string, input: { name: string }): Promise<InstitutionTypeDefinition> { return this.request(`/platform/institution-types/${code}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteInstitutionType(code: string): Promise<void> { await this.request<void>(`/platform/institution-types/${code}`, { method: "DELETE" }); }
  async tenant(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}`); }
  async createTenant(input: CreateTenantInput): Promise<Tenant> { return this.request("/platform/tenants", { method: "POST", body: JSON.stringify(input) }); }
  async updateTenant(organizationId: string, input: UpdateTenantInput): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async createTenantStaffAdmin(organizationId: string, input: { displayName: string; email: string; password: string }): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admins`, { method: "POST", body: JSON.stringify(input) }); }
  async updateTenantStaffAdmin(organizationId: string, membershipId: string, input: { displayName: string }): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admins/${membershipId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async removeTenantStaffAdmin(organizationId: string, membershipId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admins/${membershipId}/remove`, { method: "POST" }); }
  async branches(): Promise<TenantBranch[]> { return this.request("/branches"); }
  async createBranch(input: { name: string; timezone?: string }): Promise<TenantBranch> { return this.request("/branches", { method: "POST", body: JSON.stringify(input) }); }
  async updateBranch(branchId: string, input: { name: string; timezone: string }): Promise<TenantBranch> { return this.request(`/branches/${branchId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async setPrimaryBranch(branchId: string): Promise<TenantBranch> { return this.request(`/branches/${branchId}/primary`, { method: "POST" }); }
  async archiveBranch(branchId: string): Promise<TenantBranch> { return this.request(`/branches/${branchId}/archive`, { method: "POST" }); }
  async renewTenantSubscription(organizationId: string, monthlyFee?: number): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/subscription/renew`, { method: "POST", body: JSON.stringify({ monthlyFee }) }); }
  async setTenantSubscriptionStatus(organizationId: string, status: Extract<TenantSubscriptionStatus, "ACTIVE" | "SUSPENDED">): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/subscription/${status}`, { method: "POST" }); }
  async createPlatformAdmin(input: CreatePlatformAdminInput): Promise<{ id: string }> { return this.request("/platform/admins", { method: "POST", body: JSON.stringify(input) }); }
  async changePlatformAdminPin(pin: string): Promise<void> { await this.request<void>("/platform/pin", { method: "POST", body: JSON.stringify({ pin }) }); }
  async globalCurriculumPrograms(): Promise<CurriculumProgram[]> { return this.request("/platform/curriculum-programs"); }
  async createGlobalCurriculumProgram(input: Omit<CreateCurriculumProgramInput, "academicYearId">): Promise<CurriculumProgram> { return this.request("/platform/curriculum-programs", { method: "POST", body: JSON.stringify(input) }); }
  async markTenantPaymentPaid(organizationId: string, paymentId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/payments/${paymentId}/mark-paid`, { method: "POST" }); }
  async voidTenantPayment(organizationId: string, paymentId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/payments/${paymentId}/void`, { method: "POST" }); }
  async refreshTenantStaffAdminInvitation(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admin-invitation/refresh`, { method: "POST" }); }
  async cancelTenantStaffAdminInvitation(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admin-invitation/cancel`, { method: "POST" }); }
  async inviteTenantUser(input: TenantInvitationInput): Promise<{ id: string }> { return this.request("/invitations", { method: "POST", body: JSON.stringify(input) }); }
  async createTenantUser(input: CreateTenantUserInput): Promise<TenantUser> { return this.request("/tenant-users", { method: "POST", body: JSON.stringify(input) }); }
  async tenantUsers(filter: BranchListFilter = {}): Promise<TenantUser[]> { return this.request(withBranchFilter("/tenant-users", filter)); }
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
  async academicYears(): Promise<AcademicYear[]> { return this.request("/academic-years"); }
  async createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> { return this.request("/academic-years", { method: "POST", body: JSON.stringify(input) }); }
  async curriculumPrograms(): Promise<CurriculumProgram[]> { return this.request("/curriculum-programs"); }
  async createCurriculumProgram(input: CreateCurriculumProgramInput): Promise<CurriculumProgram> { return this.request("/curriculum-programs", { method: "POST", body: JSON.stringify(input) }); }
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
  async goalTemplates(): Promise<GoalTemplate[]> { return this.request("/goal-templates"); }
  async createGoalTemplate(input: UpsertGoalTemplateInput): Promise<GoalTemplate> { return this.request("/goal-templates", { method: "POST", body: JSON.stringify(input) }); }
  async updateGoalTemplate(templateId: string, input: UpsertGoalTemplateInput): Promise<GoalTemplate> { return this.request(`/goal-templates/${templateId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async archiveGoalTemplate(templateId: string): Promise<GoalTemplate> { return this.request(`/goal-templates/${templateId}/archive`, { method: "POST" }); }
  async createGoalIndicator(templateId: string, input: UpsertGoalIndicatorInput): Promise<GoalTemplate> { return this.request(`/goal-templates/${templateId}/indicators`, { method: "POST", body: JSON.stringify(input) }); }
  async updateGoalIndicator(templateId: string, indicatorId: string, input: UpsertGoalIndicatorInput): Promise<GoalTemplate> { return this.request(`/goal-templates/${templateId}/indicators/${indicatorId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async archiveGoalIndicator(templateId: string, indicatorId: string): Promise<GoalTemplate> { return this.request(`/goal-templates/${templateId}/indicators/${indicatorId}/archive`, { method: "POST" }); }
  async childGoals(childId: string): Promise<ChildGoal[]> { return this.request(`/children/${childId}/goals`); }
  async assignChildGoal(childId: string, input: { templateId: string; startsOn?: string }): Promise<ChildGoal> { return this.request(`/children/${childId}/goals`, { method: "POST", body: JSON.stringify(input) }); }
  async recordGoalCheckIn(goalId: string, date: string, indicatorId: string, outcome: GoalCheckInOutcome): Promise<ChildGoal> { return this.request(`/child-goals/${goalId}/check-ins/${date}`, { method: "PUT", body: JSON.stringify({ indicatorId, outcome }) }); }
  async finalizeChildGoal(goalId: string, input: { outcome: ChildGoalOutcome; summary: string }): Promise<ChildGoal> { return this.request(`/child-goals/${goalId}/finalize`, { method: "POST", body: JSON.stringify(input) }); }
  async childPlacements(childId: string): Promise<ChildPlacement[]> { return this.request(`/children/${childId}/placements`); }
  async placeChild(childId: string, input: { classroomId: string; startsOn?: string }): Promise<ChildPlacement> { return this.request(`/children/${childId}/placements`, { method: "POST", body: JSON.stringify(input) }); }

  async children(filter: ChildListFilter = {}): Promise<Child[]> {
    const params = new URLSearchParams();
    if (filter.branchId) params.set("branchId", filter.branchId);
    if (filter.learningLevelId) params.set("learningLevelId", filter.learningLevelId);
    if (filter.classroomId) params.set("classroomId", filter.classroomId);
    const query = params.toString();
    return this.request(`/children${query ? `?${query}` : ""}`);
  }
  async createChild(input: ChildInput): Promise<Child> { return this.request("/children", { method: "POST", body: JSON.stringify(input) }); }
  async childProfile(childId: string): Promise<ChildProfile> { return this.request(`/children/${childId}`); }
  async updateChild(childId: string, input: UpdateChildInput): Promise<Child> { return this.request(`/children/${childId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deactivateChild(childId: string): Promise<Child> { return this.request(`/children/${childId}/deactivate`, { method: "POST" }); }
  async addChildProgram(childId: string, input: { name: string; description?: string }): Promise<ChildProgram> { return this.request(`/children/${childId}/programs`, { method: "POST", body: JSON.stringify(input) }); }
  async removeChildProgram(childId: string, programId: string): Promise<void> { await this.request<void>(`/children/${childId}/programs/${programId}`, { method: "DELETE" }); }
  async assignChildStaff(childId: string, input: { userId: string; assignmentRole: ChildAssignmentRole }): Promise<ChildStaffAssignment> { return this.request(`/children/${childId}/staff-assignments`, { method: "POST", body: JSON.stringify(input) }); }
  async unassignChildStaff(childId: string, assignmentId: string): Promise<void> { await this.request<void>(`/children/${childId}/staff-assignments/${assignmentId}`, { method: "DELETE" }); }

  async recordAttendance(childId: string, command: { action: AttendanceAction; method: AttendanceMethod; qrToken?: string; note?: string }): Promise<Attendance> {
    return this.request(`/children/${childId}/attendance`, { method: "POST", body: JSON.stringify(command) });
  }

  async issueAttendanceQr(childId: string): Promise<{ token: string; expiresAt: string }> {
    return this.request(`/children/${childId}/attendance-qr`);
  }

  async developmentEntries(childId: string): Promise<DevelopmentEntry[]> {
    return this.request(`/children/${childId}/development-entries`);
  }

  async developmentCategories(): Promise<DevelopmentCategoryOption[]> { return this.request("/development-categories"); }
  async createDevelopmentCategory(input: { name: string }): Promise<DevelopmentCategoryOption> { return this.request("/development-categories", { method: "POST", body: JSON.stringify(input) }); }
  async updateDevelopmentCategory(categoryId: string, input: { name?: string; active?: boolean }): Promise<DevelopmentCategoryOption> { return this.request(`/development-categories/${categoryId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async deleteDevelopmentCategory(categoryId: string): Promise<void> { await this.request<void>(`/development-categories/${categoryId}`, { method: "DELETE" }); }

  async downloadChildrenReport(format: "PDF" | "XLSX", filter: ChildListFilter = {}): Promise<DownloadedReport> {
    const params = new URLSearchParams({ format });
    if (filter.branchId) params.set("branchId", filter.branchId);
    if (filter.learningLevelId) params.set("learningLevelId", filter.learningLevelId);
    if (filter.classroomId) params.set("classroomId", filter.classroomId);
    return this.requestFile(`/reports/children/export?${params.toString()}`);
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
    try {
      return await fetchWithTimeout(`${this.options.baseUrl}${path}`, {
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
    } catch (error) {
      if (isApiTimeoutError(error)) throw error;
      throw new ApiNetworkError();
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
