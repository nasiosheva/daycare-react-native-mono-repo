import { describe, expect, it } from "vitest";
import { createParentHomeSummary } from "./parentHomeSummary";

describe("createParentHomeSummary", () => {
  it("groups active services by child and keeps only invoices that need attention", () => {
    const summary = createParentHomeSummary(
      [
        { id: "child-a", firstName: "Alya", fullName: "Alya", organizationId: "tenant", branchId: "branch", gender: "FEMALE", dateOfBirth: "2022-01-01" },
        { id: "child-b", firstName: "Bima", fullName: "Bima", organizationId: "tenant", branchId: "branch", gender: "MALE", dateOfBirth: "2021-01-01" },
      ],
      [
        { id: "expired", branchId: "branch", childId: "child-a", childName: "Alya", planName: "Lama", type: "WEEKLY", status: "EXPIRED", totalCredits: 5, remainingCredits: 0, validUntil: "2026-07-01" },
        { id: "active-later", branchId: "branch", childId: "child-a", childName: "Alya", planName: "Bulanan", type: "MONTHLY", status: "ACTIVE", validUntil: "2026-08-31" },
        { id: "active-earlier", branchId: "branch", childId: "child-a", childName: "Alya", planName: "Mingguan", type: "WEEKLY", status: "ACTIVE", totalCredits: 5, remainingCredits: 3, validUntil: "2026-08-01" },
      ],
      [
        { id: "paid", invoiceNumber: "INV-1", branchId: "branch", childId: "child-a", childName: "Alya", parentName: null, parentEmail: null, subtotalAmount: 100, discountAmount: 0, discountName: null, discountCode: null, totalAmount: 100, status: "PAID", dueDate: "2026-07-01", createdAt: "2026-06-01T00:00:00Z", paymentProof: null },
        { id: "review", invoiceNumber: "INV-2", branchId: "branch", childId: "child-b", childName: "Bima", parentName: null, parentEmail: null, subtotalAmount: 200, discountAmount: 0, discountName: null, discountCode: null, totalAmount: 200, status: "PAYMENT_SUBMITTED", dueDate: "2026-07-20", createdAt: "2026-07-01T00:00:00Z", paymentProof: null },
        { id: "pending", invoiceNumber: "INV-3", branchId: "branch", childId: "child-a", childName: "Alya", parentName: null, parentEmail: null, subtotalAmount: 150, discountAmount: 0, discountName: null, discountCode: null, totalAmount: 150, status: "PENDING", dueDate: "2026-07-10", createdAt: "2026-07-01T00:00:00Z", paymentProof: null },
      ],
    );

    expect(summary.children[0].activeEntitlements.map((item) => item.id)).toEqual(["active-earlier", "active-later"]);
    expect(summary.children[1].activeEntitlements).toEqual([]);
    expect(summary.actionableInvoices.map((item) => item.id)).toEqual(["pending", "review"]);
  });
});
