# Child health record load error state

## Change

- `child-health.tsx` never checked `record.isError`. When the health-record fetch failed (403 out of scope, 404 unknown child, network error, etc.), a Staff/Staff Admin viewer with `canEdit` would silently see a blank, fully editable form — indistinguishable from a child that legitimately has no health record yet — with no indication the load had failed.
- Added an explicit error state (message + retry button, matching the pattern already used in `development.tsx`/`branches.tsx`/`classrooms.tsx`) and gated the empty-state and form rendering on `!record.isError`.
- Added the `health.loadFailed` translation key across all seven supported locales.
- No change to `docs/business-rules.md`: this is a client-side defensive-error-handling fix, not a change to user flow, business rules, or API contracts — the backend authorization/scope behavior for `GET /children/{childId}/health` is unchanged.

## Verification

- `tsc --noEmit` passed for the mobile app.
- `expo lint` shows no new issues in `apps/mobile/app/child-health.tsx` (the one `import/no-unresolved` error reported for this file is pre-existing and unrelated).
