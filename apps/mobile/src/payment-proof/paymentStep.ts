import type { InvoiceStatus } from "@daycare/core";

/**
 * Step of the transfer → upload proof → verification flow for an invoice.
 * A value past the last step means every step is done.
 */
export function paymentStepForInvoice(status: InvoiceStatus | undefined, screen: "instructions" | "upload"): number {
  if (status === "PAID") return 4;
  if (status === "PAYMENT_SUBMITTED") return 3;
  return screen === "upload" ? 2 : 1;
}
