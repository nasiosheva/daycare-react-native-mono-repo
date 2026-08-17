# Parent enrollment and payment flow

## Purpose

This flow lets a globally registered `PARENT` apply to a tenant before making a payment. Tenant access is granted after Staff Admin approval, while the purchased service becomes active only after payment proof is verified.

## Parent journey

1. A first-time Parent signs in and sees the limited onboarding navigation: Home, Enrollment, and Profile.
2. The Parent selects a tenant and branch, adds one or more children, then selects a service plan.
3. Submission creates one `PENDING_APPROVAL` enrollment per child. The selected package, discount, and amount are stored as an immutable application snapshot. No invoice, entitlement, booking, or capacity reservation is created at this point.
4. The Parent waits for a Staff Admin decision.
5. When approved, the system creates or reactivates the tenant `PARENT` membership, activates the child, creates the guardian link, invoice, and `PENDING_PAYMENT` entitlement.
6. The Parent selects **Bayar** to read the tenant's active transfer instructions, transfers the amount, then uploads a single JPEG or PNG payment proof.
7. A Staff Admin verifies the proof. The invoice becomes paid and the entitlement becomes active; only then can the Parent use package-dependent services such as booking.

## Tenant transfer

A Parent with an active child at one tenant can request to move that child to a different tenant from the child's profile screen. This reuses the same enrollment wizard and Staff Admin approval mechanism as a brand-new application, with two differences:

- The child step is skipped: name, gender, and date of birth are copied from the existing (origin) child instead of typed in. The destination tenant/branch must differ from the origin, the origin child must be active, and only one pending transfer per child is allowed at a time.
- History (attendance, development, health, incidents, Program Pendampingan) never moves with the child — it stays at the origin tenant per the retention rules the rest of this app follows (archive, never hard-delete). The origin child is only marked inactive and `TRANSFERRED` when the destination tenant's Staff Admin **approves** the request, not when the Parent submits it; a rejected or still-pending transfer leaves the origin child untouched and fully active. The origin tenant has no separate approval step of its own.

## Staff Admin requirements

Before approving any Parent enrollment, Staff Admin must configure at least one active payment instruction. Instructions are tenant-scoped and can contain a bank account or e-wallet name, account holder, account number, optional note, active state, and display order.

Staff Admin decides Parent enrollment from Booking Approvals. The decision happens before payment; payment proof review remains in the Parent Payments workflow.

## Rejection, cancellation, and expiry

- A rejected application does not create an invoice or entitlement. The Parent submits a new application when ready.
- A Parent may cancel only an application in `PENDING_APPROVAL`; cancellation deactivates its pending child and does not create billing records.
- If an approved enrollment invoice becomes overdue, its pending entitlement expires. When the Parent has no other active entitlement in that tenant, the tenant Parent membership is deactivated and the Parent returns to limited onboarding/billing access. A new application starts the flow again.

## API and data model

- `parent_enrollments` contains the locked plan/discount/amount snapshot and initially has no invoice or entitlement reference.
- `POST /api/v1/parent-enrollment/checkout` creates applications.
- `POST /api/v1/parent-enrollment/{enrollmentId}/approval` creates billing records only on approval.
- `GET /api/v1/payment-instructions` lists active instructions for the approved Parent payment journey.
- Staff Admin manages instructions through `GET /manage`, `POST`, `PATCH`, and `DELETE /api/v1/payment-instructions`.

Related operational documentation is kept in the [repository README](../README.md).
