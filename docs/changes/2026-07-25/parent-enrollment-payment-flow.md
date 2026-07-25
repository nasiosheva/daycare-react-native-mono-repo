# Parent enrollment payment flow

Date: 2026-07-25

## Context

Parent enrollment was changed so Staff Admin approval happens before payment. This replaces the previous sequence where payment was submitted before Staff Admin approved the Parent–tenant relationship.

## Changed behavior

- A newly registered Parent has onboarding navigation only: Home, Enrollment, and Profile.
- Parent selects tenant, branch, child data, and package. Submission creates a `PENDING_APPROVAL` application with a locked plan, discount, and amount snapshot.
- Staff Admin approval creates the Parent tenant membership, guardian link, invoice, and pending entitlement.
- Each tenant configures its own manual-transfer instructions. Parent reads them from **Bayar** and uploads proof only after transferring.
- Payment-proof approval activates the entitlement.
- A pending approval application may be cancelled without billing records. A rejected or overdue application is submitted again from the beginning.
- An overdue approved-enrollment invoice removes tenant access when the Parent has no other active service in that tenant.

## Affected areas

- Spring API enrollment lifecycle, persistence migration, payment-instruction endpoints, authorization, local seed data, and localized error responses.
- Typed API client contracts.
- Parent onboarding, enrollment, payment, and Staff Admin instruction-management screens.
- Repository README and permanent [Parent enrollment and payment flow](../../parent-enrollment-flow.md) reference.

## Verification

- `corepack pnpm verify` passed.
- `gradle -p apps/api test --no-daemon` passed with JDK 21.
- `git diff --check` passed.

## Follow-up

- Future changes to this lifecycle must update this daily context note for the day they are made and the permanent flow document when behavior changes.
