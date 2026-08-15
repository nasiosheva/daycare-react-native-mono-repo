# Branch edit validation message

## Change

- Fixed `branches.tsx`'s save-validation `Alert` (missing name/timezone/full address) to include an explanatory message (`tenant.branchRequired`), instead of showing only the generic `tenant.branchFailed` title with no detail.
- Added the `tenant.branchRequired` translation key across all seven supported locales (id, en, zh, fr, pt, es, ru).
- No change to validation rules themselves (name, timezone, and full address remain required to save a branch) or to any API contract — this only clarifies which fields are missing when the client-side check blocks the save.
- README.md was not updated: this does not change user flow, business rules, API contracts, configuration, or local/prod operation, only the wording of an existing client-side validation message.

## Verification

- `tsc --noEmit` passed for the mobile app (confirms `tenant.branchRequired` is present in all locale records).
- `expo lint` shows no new issues in `apps/mobile/app/branches.tsx` or `apps/mobile/src/i18n/translations.ts` (all 59 pre-existing lint findings are in unrelated files).
