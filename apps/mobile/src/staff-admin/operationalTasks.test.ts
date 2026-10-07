import { describe, expect, it } from "vitest";
import { createStaffAdminOperationalTasks } from "./operationalTasks";

describe("createStaffAdminOperationalTasks", () => {
  it("only exposes server states that still need Staff Admin action", () => {
    const tasks = createStaffAdminOperationalTasks({
      invoices: [{ status: "PAYMENT_SUBMITTED" }, { status: "PENDING" }] as never,
      pendingBookings: [{ status: "PENDING_APPROVAL" }, { status: "CONFIRMED" }] as never,
      pendingEnrollments: [{ status: "PENDING_APPROVAL" }, { status: "APPROVED" }] as never,
      pendingStaffLeaveRequests: [{ status: "PENDING" }, { status: "REJECTED" }] as never,
      tenantFeedback: [{ status: "NEW" }, { status: "READ" }] as never,
      privateTutoringRequests: [{ status: "PENDING_APPROVAL" }, { status: "CONFIRMED" }] as never,
    });

    expect(tasks).toEqual([
      { kind: "PAYMENT_PROOF_REVIEW", count: 1 },
      { kind: "BOOKING_APPROVAL", count: 1 },
      { kind: "ENROLLMENT_APPROVAL", count: 1 },
      { kind: "STAFF_LEAVE_APPROVAL", count: 1 },
      { kind: "TENANT_FEEDBACK_REVIEW", count: 1 },
      { kind: "PRIVATE_TUTORING_APPROVAL", count: 1 },
    ]);
  });

  it("returns no task when every item is already terminal or reviewed", () => {
    expect(createStaffAdminOperationalTasks({
      invoices: [{ status: "PAID" }] as never,
      pendingBookings: [{ status: "CONFIRMED" }] as never,
      pendingEnrollments: [{ status: "APPROVED" }] as never,
      pendingStaffLeaveRequests: [{ status: "APPROVED" }] as never,
      tenantFeedback: [{ status: "RESOLVED" }] as never,
      privateTutoringRequests: [{ status: "REJECTED" }] as never,
    })).toEqual([]);
  });
});
