import { describe, expect, it } from "vitest";
import { createStaffAdminSummary } from "./staffAdminSummary";

describe("createStaffAdminSummary", () => {
  it("summarizes operational and financial tenant data", () => {
    const summary = createStaffAdminSummary({
      children: [{}, {}],
      users: [
        { role: "STAFF_ADMIN", status: "ACTIVE" },
        { role: "STAFF", status: "ACTIVE" },
        { role: "STAFF", status: "INACTIVE" },
        { role: "PARENT", status: "ACTIVE" },
      ] as never,
      pendingBookings: [{ status: "PENDING_APPROVAL" }, { status: "CONFIRMED" }] as never,
      pendingEnrollments: [{}],
      invoices: [{ status: "PENDING" }, { status: "PAID" }] as never,
      entitlements: [
        { status: "ACTIVE", remainingCredits: 3 },
        { status: "ACTIVE", remainingCredits: null },
        { status: "EXPIRED", remainingCredits: 5 },
      ] as never,
    });

    expect(summary).toEqual({ activeChildren: 2, activeStaff: 2, pendingApprovals: 2, pendingInvoices: 1, activeSubscriptions: 2, remainingCredits: 3 });
  });
});
