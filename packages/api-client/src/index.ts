import type { AttendanceAction, AttendanceMethod, BookingStatus, ChildInput, CurrentUser, DevelopmentCategory, DevelopmentEntryInput, InvoiceStatus, PurchaseServiceInput, ServicePlanType, UnusedCreditPolicy } from "@daycare/core";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  getOrganizationId: () => string | null;
};

export type Child = ChildInput & { id: string; fullName: string; organizationId: string };
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
export type ServiceEntitlement = { id: string; childId: string; planName: string; type: ServicePlanType; status: "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "EXHAUSTED"; remainingCredits?: number; validUntil: string };
export type Booking = { id: string; childId: string; childName: string; bookingDate: string; status: BookingStatus; planName: string; invoiceId: string };
export type Invoice = { id: string; invoiceNumber: string; childId: string; childName: string; totalAmount: number; status: InvoiceStatus; dueDate: string; createdAt: string };

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async me(): Promise<CurrentUser> {
    return this.request("/me");
  }

  async children(): Promise<Child[]> {
    return this.request("/children");
  }

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
    return response.json() as Promise<T>;
  }
}
