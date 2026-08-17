# Parent-initiated child transfer to another tenant

## Change

Added a first version of the flow discussed in `docs/business-rules.md` §3 (previously only sketched as a `TRANSFERRED` status name in the aspirational §12/§13 target sections, with zero implementation anywhere in the codebase): a Parent can now request to move an actively-enrolled child to a different tenant.

- **Backend**: new `ChildEnrollmentStatus.TRANSFERRED` value; new nullable `parent_enrollments.transferred_from_child_id` column (migration `V12__parent_child_transfer.sql`) linking a transfer application back to the origin child; new `POST /api/v1/parent-enrollment/transfer` endpoint (`ParentEnrollmentService.transferCheckout`) that copies the origin child's name/gender/date of birth into a new `PENDING` child at the destination tenant and creates a normal `PENDING_APPROVAL` enrollment there. `decide()` now additionally marks the origin child `active=false`/`TRANSFERRED` when a transfer enrollment is approved — never on submission or rejection.
- **Guards**: requester must be a guardian of the origin child; origin child must be active and `ACTIVE`-enrolled; destination must differ from the origin tenant; only one pending transfer per child at a time; same "not already an active Parent at the destination" check as a normal application.
- **History**: deliberately left untouched at the origin tenant per the existing archive/deactivate retention rule (§9) — there is no cross-tenant query or copy of attendance, development, health, incident, or Program Pendampingan records. The two `Child` rows are linked only by the `transferredFromChildId` marker on the enrollment application itself.
- **Mobile**: `parent-child-profile.tsx` gained a "Pindahkan ke Tenant Lain" card; `parent-enrollment-form.tsx` now supports a transfer mode (via `transferChildId`/`transferChildName` route params) that reuses the existing branch → plan → review wizard but skips the child-details step, pre-filling everything from the origin child; `parent-enrollment.tsx` shows a "Pindahan dari {tenant}" caption on transfer applications.

## Verification

- `apps/api/gradlew test` passed (full suite), including three new `ParentEnrollmentServiceTest` cases: successful transfer checkout copies the origin child's fields, a same-tenant transfer is rejected, and approving a transfer marks the origin child inactive/`TRANSFERRED`.
- Migration `V12` applied cleanly against the local dev database; new column and FK/index verified via `psql`.
- `tsc --noEmit`, `expo lint`, and `corepack pnpm test` (mobile, vitest, 84/84) all passed for the mobile app.
- `docs/business-rules.md` §3 and `docs/parent-enrollment-flow.md` updated to describe the new flow; `README.md` updated with the new endpoint.
- Not done: a live authenticated walkthrough as a signed-in Parent (submit a transfer, approve it as the destination tenant's Staff Admin, confirm the origin child becomes inactive in the UI) — this session has no working credentials for a seeded Parent or Staff Admin account in the local dev database.
