# Profile username management

## Change

- Added an optional username field to the personal Profile form for every signed-in role.
- Added `PATCH /api/v1/me/username`; the API resolves the current authenticated account, validates global uniqueness, and returns the refreshed current-user payload.
- Added `username` to the shared current-user contract so Profile can show its saved value.

## Affected behavior

- A user may add, replace, or clear their username from Profile without changing their email or password.
- A non-empty username is globally unique and must contain 2 to 100 characters.
- The existing email-or-username plus password login flow can use a saved username.

## Verification

- TypeScript verification: `corepack pnpm verify`.
- API verification: `gradle -p apps/api test --no-daemon` with the configured integration database.

## Follow-up

- None.
