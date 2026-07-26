# Tenant Staff Admin username

## Change

- Added an optional username field to the Platform Admin's **Tambah Staff Admin** form in Tenant Detail while keeping email mandatory.
- Extended the Platform Staff Admin creation API and typed client input to carry the username.
- `TenantUserAccountService` now stores a supplied username in the global user profile, rejects a username that is already registered, and uses that username as the Firebase display name while preserving the submitted display name as the application's display name.

## Affected behavior

- Adding a secondary Staff Admin requires display name, email, and a password of at least six characters. A globally unique username may be supplied.
- Sign-in accepts either the required email or a configured username. Before Firebase Email/Password authentication, the public API resolves a configured username to the account email; a missing username is rejected before Firebase is called.
- The first Staff Admin created together with a tenant and the tenant-managed Staff account flow retain their existing inputs; this change is scoped to the Platform Admin Tenant Detail action.

## Verification

- Added backend unit coverage for username-to-email resolution and typed-client coverage for the public resolution route.
- `corepack pnpm verify` passed.
- `./apps/api/gradlew -p apps/api test --no-daemon` passed with JDK 21.

## Follow-up

- Firebase Email/Password remains the authentication provider; the username is a convenience identifier and never replaces the required Firebase email.
