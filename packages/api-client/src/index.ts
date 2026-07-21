import type { AttendanceAction, AttendanceMethod, BookingStatus, ChildInput, CurrentUser, DevelopmentCategory, DevelopmentEntryInput, InstitutionCapability, InstitutionType, InvoiceStatus, PurchaseServiceInput, Role, ServicePlanType, TenantPaymentStatus, TenantSubscriptionPlan, TenantSubscriptionStatus, UnusedCreditPolicy } from "@daycare/core";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  getOrganizationId: () => string | null;
  getLanguage: () => string;
};

export type Child = ChildInput & { id: string; fullName: string; organizationId: string };
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
  category: DevelopmentCategory;
  title: string;
  content: string;
  recordedAt: string;
  recordedBy: string;
};
export type ServicePlan = { id: string; name: string; type: ServicePlanType; price: number; creditCount?: number; unusedCreditPolicy?: UnusedCreditPolicy; carryForwardDays?: number; bookingRequiresApproval: boolean };
export type ServiceEntitlement = { id: string; childId: string; childName: string; parentName?: string | null; parentEmail?: string | null; planName: string; type: ServicePlanType; status: "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "EXHAUSTED"; totalCredits?: number | null; remainingCredits?: number | null; validUntil: string };
export type Booking = { id: string; childId: string; childName: string; bookingDate: string; status: BookingStatus; planName: string; invoiceId: string };
export type Invoice = { id: string; invoiceNumber: string; childId: string; childName: string; parentName?: string | null; parentEmail?: string | null; totalAmount: number; status: InvoiceStatus; dueDate: string; createdAt: string };
export type TenantPayment = { id: string; amount: number; status: TenantPaymentStatus; dueDate: string; paidAt: string | null };
export type TenantStaffAdmin = { id: string; email: string | null; displayName: string | null; status: "ACTIVE" | "PENDING" };
export type Tenant = { id: string; name: string; branchName: string | null; institutionTypes: InstitutionType[]; capabilities: InstitutionCapability[]; subscriptionPlan: TenantSubscriptionPlan | null; subscriptionStatus: TenantSubscriptionStatus | null; periodStart: string | null; periodEnd: string | null; trialEndsAt: string | null; monthlyFee: number | null; staffAdmin: TenantStaffAdmin | null; payments: TenantPayment[] };
export type CreateTenantInput = { tenantName: string; branchName: string; institutionTypes: InstitutionType[]; subscriptionPlan: TenantSubscriptionPlan; monthlyFee?: number; trialMonths?: number; staffAdminEmail: string };
export type UpdateTenantInput = { tenantName: string; branchName: string; institutionTypes: InstitutionType[]; subscriptionPlan: TenantSubscriptionPlan; monthlyFee?: number };
export type CreatePlatformAdminInput = { email: string; username: string; password: string };
export type AcademicYear = { id: string; name: string; startsOn: string; endsOn: string; active: boolean };
export type CreateAcademicYearInput = { name: string; startsOn: string; endsOn: string };
export type CurriculumProgram = { id: string; academicYearId: string; name: string; description: string };
export type CreateCurriculumProgramInput = { academicYearId: string; name: string; description: string };
export type TenantInvitationInput = { email?: string; phoneNumber?: string; role: Extract<Role, "STAFF" | "PARENT">; branchId?: string; classroomId?: string };
export type TenantUser = { id: string; userId: string | null; displayName: string | null; email: string | null; role: Extract<Role, "STAFF_ADMIN" | "STAFF" | "PARENT">; status: "ACTIVE" | "PENDING" };

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async me(): Promise<CurrentUser> {
    return this.request("/me");
  }

  async tenants(): Promise<Tenant[]> { return this.request("/platform/tenants"); }
  async tenant(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}`); }
  async createTenant(input: CreateTenantInput): Promise<Tenant> { return this.request("/platform/tenants", { method: "POST", body: JSON.stringify(input) }); }
  async updateTenant(organizationId: string, input: UpdateTenantInput): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}`, { method: "PATCH", body: JSON.stringify(input) }); }
  async renewTenantSubscription(organizationId: string, monthlyFee?: number): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/subscription/renew`, { method: "POST", body: JSON.stringify({ monthlyFee }) }); }
  async setTenantSubscriptionStatus(organizationId: string, status: Extract<TenantSubscriptionStatus, "ACTIVE" | "SUSPENDED">): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/subscription/${status}`, { method: "POST" }); }
  async createPlatformAdmin(input: CreatePlatformAdminInput): Promise<{ id: string }> { return this.request("/platform/admins", { method: "POST", body: JSON.stringify(input) }); }
  async changePlatformAdminPin(pin: string): Promise<void> { await this.request<void>("/platform/pin", { method: "POST", body: JSON.stringify({ pin }) }); }
  async markTenantPaymentPaid(organizationId: string, paymentId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/payments/${paymentId}/mark-paid`, { method: "POST" }); }
  async voidTenantPayment(organizationId: string, paymentId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/payments/${paymentId}/void`, { method: "POST" }); }
  async refreshTenantStaffAdminInvitation(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admin-invitation/refresh`, { method: "POST" }); }
  async cancelTenantStaffAdminInvitation(organizationId: string): Promise<Tenant> { return this.request(`/platform/tenants/${organizationId}/staff-admin-invitation/cancel`, { method: "POST" }); }
  async inviteTenantUser(input: TenantInvitationInput): Promise<{ id: string }> { return this.request("/invitations", { method: "POST", body: JSON.stringify(input) }); }
  async tenantUsers(): Promise<TenantUser[]> { return this.request("/tenant-users"); }
  async changeTenantUserPassword(userId: string, password: string): Promise<void> { await this.request<void>(`/tenant-users/${userId}/password`, { method: "POST", body: JSON.stringify({ password }) }); }
  async academicYears(): Promise<AcademicYear[]> { return this.request("/academic-years"); }
  async createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> { return this.request("/academic-years", { method: "POST", body: JSON.stringify(input) }); }
  async curriculumPrograms(): Promise<CurriculumProgram[]> { return this.request("/curriculum-programs"); }
  async createCurriculumProgram(input: CreateCurriculumProgramInput): Promise<CurriculumProgram> { return this.request("/curriculum-programs", { method: "POST", body: JSON.stringify(input) }); }

  async children(): Promise<Child[]> {
    return this.request("/children");
  }
  async createChild(input: ChildInput): Promise<Child> { return this.request("/children", { method: "POST", body: JSON.stringify(input) }); }
  async childProfile(childId: string): Promise<ChildProfile> { return this.request(`/children/${childId}`); }
  async updateChild(childId: string, input: UpdateChildInput): Promise<Child> { return this.request(`/children/${childId}`, { method: "PATCH", body: JSON.stringify(input) }); }
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

  async createDevelopmentEntry(childId: string, input: DevelopmentEntryInput): Promise<DevelopmentEntry> {
    return this.request(`/children/${childId}/development-entries`, { method: "POST", body: JSON.stringify(input) });
  }

  async servicePlans(): Promise<ServicePlan[]> { return this.request("/service-plans"); }
  async createServicePlan(input: Omit<ServicePlan, "id">): Promise<ServicePlan> { return this.request("/service-plans", { method: "POST", body: JSON.stringify(input) }); }
  async purchaseService(input: PurchaseServiceInput): Promise<{ entitlement: ServiceEntitlement; invoice: Invoice; bookings: Booking[] }> { return this.request("/service-purchases", { method: "POST", body: JSON.stringify(input) }); }
  async entitlements(): Promise<ServiceEntitlement[]> { return this.request("/service-entitlements"); }
  async bookEntitlement(entitlementId: string, bookingDates: string[]): Promise<Booking[]> { return this.request(`/service-entitlements/${entitlementId}/bookings`, { method: "POST", body: JSON.stringify({ bookingDates }) }); }
  async bookings(): Promise<Booking[]> { return this.request("/bookings"); }
  async pendingBookings(): Promise<Booking[]> { return this.request("/bookings/pending-approval"); }
  async approveBooking(bookingId: string, approved: boolean): Promise<Booking> { return this.request(`/bookings/${bookingId}/approval`, { method: "POST", body: JSON.stringify({ approved }) }); }
  async invoices(): Promise<Invoice[]> { return this.request("/invoices"); }
  async markInvoicePaid(invoiceId: string): Promise<Invoice> { return this.request(`/invoices/${invoiceId}/mark-paid`, { method: "POST" }); }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.options.getToken();
    const organizationId = this.options.getOrganizationId();
    const response = await fetch(`${this.options.baseUrl}${path}`, {
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

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
      throw new ApiError(response.status, body.code ?? "UNKNOWN", body.detail ?? "Request failed");
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
