import { describe, expect, it } from "vitest";
import { statusTone } from "./statusTone";

describe("statusTone", () => {
  it("asks the parent to act on unpaid invoices", () => {
    expect(statusTone("PENDING")).toBe("warning");
    expect(statusTone("PAYMENT_DUE")).toBe("warning");
  });

  it("shows items waiting on the institution as informational", () => {
    expect(statusTone("PAYMENT_SUBMITTED")).toBe("info");
    expect(statusTone("PENDING_APPROVAL")).toBe("info");
  });

  it("maps finished, refused and unknown statuses", () => {
    expect(statusTone("PAID")).toBe("success");
    expect(statusTone("REJECTED")).toBe("danger");
    expect(statusTone("OVERDUE")).toBe("danger");
    expect(statusTone("CANCELLED")).toBe("neutral");
    expect(statusTone("SOMETHING_NEW")).toBe("neutral");
  });
});
