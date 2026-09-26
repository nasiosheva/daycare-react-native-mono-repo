import type { Tone } from "@daycare/ui";

const successStatuses = new Set(["ACTIVE", "APPROVED", "CONFIRMED", "COMPLETED", "GRANTED", "PAID", "RESOLVED", "VERIFIED"]);
const warningStatuses = new Set(["PENDING", "PENDING_PAYMENT", "PAYMENT_DUE", "PENDING_VERIFICATION", "NEW"]);
const infoStatuses = new Set(["PENDING_APPROVAL", "PAYMENT_SUBMITTED", "PAYMENT_REVIEW", "SUBMITTED", "READ"]);
const dangerStatuses = new Set(["REJECTED", "DECLINED", "OVERDUE", "REVOKED", "SUSPENDED"]);

/**
 * Badge tone for any backend status value.
 * warning = the user still has to act (pay, verify), info = waiting on someone else,
 * danger = refused or overdue, neutral = finished or no longer relevant.
 */
export function statusTone(status: string): Tone {
  if (successStatuses.has(status)) return "success";
  if (warningStatuses.has(status)) return "warning";
  if (infoStatuses.has(status)) return "info";
  if (dangerStatuses.has(status)) return "danger";
  return "neutral";
}
