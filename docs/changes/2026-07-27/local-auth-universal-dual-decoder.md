# Universal local-auth password login + phone registration gate

## Context

Firebase Email/Password sign-in was disabled at the Firebase Console level for every role. Firebase now only handles Google Sign-In and phone-number (OTP) identity verification. Per business rules (`docs/business-rules.md` §1–§2), email/username-and-password login must be checked against the application's own database, not a Firebase account, and no brand-new Firebase identity may silently become an application account.

## Changes

- `SecurityConfig.kt`: `jwtDecoder()` now dispatches per-request between a local `NimbusJwtDecoder` and the Firebase issuer decoder, based on the unverified `iss` claim peeked via Nimbus's `SignedJWT.parse(...).jwtClaimsSet.issuer`. Both decoders are always registered; previously only one was active depending on `daycare.local-auth-enabled`.
- `LocalAuthenticationService.kt`, `LocalJwtService`, `LocalAuthenticationController`: the `@ConditionalOnProperty(daycare.local-auth-enabled)` gate was removed. Local password login is now an always-on path for every environment and every password-using role (Staff, Staff Admin, Platform Admin), not a development-only fallback. `LOCAL_TOKEN_ISSUER` was made package-visible so `SecurityConfig` can route on it.
- `TenantUserAccountService.kt` and `PlatformAdministrationService.kt`: Staff, Staff Admin, and Platform Admin provisioning now always creates an application identity with a BCrypt password hash. It no longer attempts Firebase Email/Password provisioning or password changes, so the created account can use the universal email/username-and-password flow in every environment.
- `IdentityAndAccessService.kt`: adds `IdentityService.checkIdentity(jwt)` (read-only; reports whether a `UserProfile` already exists by Firebase UID, email, or phone) and refuses to synchronize unknown Firebase identities. The unknown identity must use the Parent registration form.
- `Controllers.kt`: adds `GET /v1/auth/identity-check`; removes `LoginIdentifierController`/`POST /v1/auth/resolve-username` and `LoginIdentifierService.kt`, which became dead code once password login no longer resolves a username to an email before calling Firebase.
- `packages/api-client`: adds `identityCheck()` and removes `resolveLoginUsername`.
- Mobile: `AuthProvider.tsx` tracks two independent, coexisting session states — `localSession` (password login) and `firebaseUser` (Google/Phone verification) — instead of one build-time `env.isLocalAuth` flag choosing between them. Unknown Google and OTP identities are routed to `sign-up`, while known Google identities return to password sign-in. `usesPassword` was added to the auth context so `profile.tsx` only shows "Ubah password" for password-based sessions.
- `_layout.tsx`: registers `verify-phone` in the root Stack (`{ animation: "none" }`, matching the other auth screens).

## Not changed

- Google and phone-number identity verification still goes through real Firebase; this patch does not touch that. Only email/username+password moved off Firebase.
- `LocalPlatformAdminSeeder.kt` (dev-only seed data, gated by `local-seed-enabled` + `@Profile("local")`) is unrelated to whether the local-auth login mechanism itself is available, and was not touched.

## Verification

- `gradle compileKotlin`: `BUILD SUCCESSFUL`.
- `pnpm --filter @daycare/api-client typecheck`: clean. `pnpm --filter @daycare/api-client test`: 16/16 pass.
- `pnpm --filter @daycare/app typecheck`: clean. `pnpm --filter @daycare/app test`: 14 files / 28 tests pass.
- Not yet done: manual end-to-end run of Google/phone verification → `sign-up`, and of password login against the local database, on a device/simulator/browser (no such access in this session).

## Follow-up

- `scripts/run-backend-local.sh`'s `require_local_backend_values()` currently skips requiring `FIREBASE_ISSUER_URI` when `LOCAL_AUTH_ENABLED=true`. Since local auth is now additive rather than an alternative to Firebase, `FIREBASE_ISSUER_URI` should always be required regardless of that flag. Deferred — not part of this patch.
