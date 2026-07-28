# Parent family profile

## Change

- Added an optional global family profile for self-registered Parent accounts after signup.
- The dedicated Profile child screen records husband/wife date of birth, occupation, and monthly income range through reusable option selectors.
- The form explains that its data supports manual school-fee consideration and does not appear in signup.

## Behavior and privacy

- Every field is optional. Occupation and income range use a fixed system list; dates cannot be in the future.
- The profile belongs to the Parent account, not a tenant, and remains available while switching tenants.
- Only the owner with `registrationRole=PARENT` can read or update it. It is excluded from tenant/staff access and does not change fees, plans, bookings, credits, or notifications.

## Verification

- Added core schema, API-client contract, and Spring service tests for Parent authorization, optional persistence, and future-date rejection.
- Run `corepack pnpm verify` and `gradle -p apps/api test --no-daemon` with JDK 21.
