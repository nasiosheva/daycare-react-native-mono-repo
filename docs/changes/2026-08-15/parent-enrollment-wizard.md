# Parent enrollment wizard

## Change

- Replace the long Parent enrollment Bottom Sheet with a full-page three-step wizard for branch selection, child data, and package review.
- Keep one selected package for every child in the request, show the catalog price per child, and explain the `PENDING_APPROVAL` boundary before submission.
- Add localized inline validation, catalog retry/error handling, and draft-preserving back navigation.

## Affected behavior

- Parent self-enrollment presentation changes only. The checkout endpoint, payload, authorization, package snapshot, approval, invoice, entitlement, and payment lifecycles are unchanged.
- A request remains limited to 1–10 children, and no invoice or booking is created when the Parent submits it.

## Verification

- `corepack pnpm lint` passed.
- `corepack pnpm typecheck` passed.
- `corepack pnpm test` passed, including 78 mobile tests and the new enrollment-form validation coverage.
- `corepack pnpm --filter @daycare/app exec expo export --platform web` passed and produced a complete web bundle.
- Backend tests were not rerun because the endpoint, backend implementation, and database schema did not change.

## Follow-up

- None planned; any future branch-specific package relationship requires a separate documented API and data-contract decision.
