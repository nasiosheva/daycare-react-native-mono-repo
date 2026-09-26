import { describe, expect, it } from "vitest";
import { paymentStepForInvoice } from "./paymentStep";

describe("paymentStepForInvoice", () => {
  it("starts at the transfer step on the instructions screen and at upload on the proof screen", () => {
    expect(paymentStepForInvoice("PENDING", "instructions")).toBe(1);
    expect(paymentStepForInvoice("PENDING", "upload")).toBe(2);
    expect(paymentStepForInvoice(undefined, "instructions")).toBe(1);
  });

  it("moves to verification once proof is submitted and completes when paid", () => {
    expect(paymentStepForInvoice("PAYMENT_SUBMITTED", "instructions")).toBe(3);
    expect(paymentStepForInvoice("PAID", "upload")).toBe(4);
  });
});
