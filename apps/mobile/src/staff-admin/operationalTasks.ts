import type { Booking, Invoice, ParentEnrollment, PrivateTutoringRequest, StaffLeaveRequest, TenantFeedback } from "@daycare/api-client";

export const operationalTaskKinds = [
  "PAYMENT_PROOF_REVIEW",
  "BOOKING_APPROVAL",
  "ENROLLMENT_APPROVAL",
  "STAFF_LEAVE_APPROVAL",
  "TENANT_FEEDBACK_REVIEW",
  "PRIVATE_TUTORING_APPROVAL",
] as const;

export type OperationalTaskKind = (typeof operationalTaskKinds)[number];

export type OperationalTask = {
  kind: OperationalTaskKind;
  count: number;
};

type StaffAdminOperationalTaskInput = {
  invoices: readonly Invoice[];
  pendingBookings: readonly Booking[];
  pendingEnrollments: readonly ParentEnrollment[];
  pendingStaffLeaveRequests: readonly StaffLeaveRequest[];
  tenantFeedback: readonly TenantFeedback[];
  privateTutoringRequests: readonly PrivateTutoringRequest[];
};

/**
 * Converts existing server-owned list states into read-only navigation tasks.
 * The caller decides which capability-gated lists are loaded; this helper never
 * infers authorization and never mutates the underlying resources.
 */
export function createStaffAdminOperationalTasks(input: StaffAdminOperationalTaskInput): OperationalTask[] {
  const counts: Record<OperationalTaskKind, number> = {
    PAYMENT_PROOF_REVIEW: input.invoices.filter((invoice) => invoice.status === "PAYMENT_SUBMITTED").length,
    BOOKING_APPROVAL: input.pendingBookings.filter((booking) => booking.status === "PENDING_APPROVAL").length,
    ENROLLMENT_APPROVAL: input.pendingEnrollments.filter((enrollment) => enrollment.status === "PENDING_APPROVAL").length,
    STAFF_LEAVE_APPROVAL: input.pendingStaffLeaveRequests.filter((request) => request.status === "PENDING").length,
    TENANT_FEEDBACK_REVIEW: input.tenantFeedback.filter((feedback) => feedback.status === "NEW").length,
    PRIVATE_TUTORING_APPROVAL: input.privateTutoringRequests.filter((request) => request.status === "PENDING_APPROVAL").length,
  };

  return operationalTaskKinds.flatMap((kind) => counts[kind] > 0 ? [{ kind, count: counts[kind] }] : []);
}
