# Google and phone entry points for Parent registration

## Context

Google Sign-In and phone OTP are identity-verification methods for a Parent self-registration path. They must not appear on the ordinary sign-in screen, where all roles enter with email/username and password. The Parent registration screen is the only UI entry point for the required Firebase Google and phone authentication, including production. A Firebase identity must never create an application account implicitly.

## Changes

- `apps/mobile/app/sign-in.tsx`: contains only email/username and password sign-in plus the link to Parent registration. The unused Google handler/imports were removed with the entry point.
- `apps/mobile/app/sign-up.tsx`: offers Parent account creation, Google verification, and phone OTP. The Google action carries the provider icon through the shared `Button` leading-icon slot; phone opens `/verify-phone`. A new verified identity stays on this form, and a verified Google email is locked as the required registration email.
- `IdentityService`: looks up existing accounts by Firebase UID, email, or phone number and no longer creates a `UserProfile` as a side effect of `/me` or any other authenticated request. Unknown identities receive a localized `REGISTRATION_REQUIRED` response if they attempt a protected endpoint directly.
- `POST /auth/local/register`: optionally accepts a Firebase bearer token. It verifies that a submitted email matches a Google-verified email, persists a verified phone number only after successful registration, and creates the Parent's local password session. The obsolete `complete-registration` endpoint, API-client method, route, and screen were removed.
- The current authentication configuration requires Firebase identity values, so Google and phone actions are not hidden behind the removed local-auth flag.
- `README.md`: documents that Google and phone actions live only under Parent registration, while the sign-in screen remains the email/username-and-password entry point.
- `translations.ts`: removes the obsolete institution-management sign-in subtitle and the obsolete complete-registration labels.

## Not changed

- Existing phone identities retain their no-password OTP session. Existing Google identities are explicitly returned to password sign-in because Google is verification-only.
- `EXPO_PUBLIC_APP_ENV` remains the release-build precondition described in `docs/android-release-apk.md`; it does not decide whether the Parent registration actions are shown.

## Verification

- `corepack pnpm verify` — passed (workspace lint, TypeScript typecheck, and tests).
- No Firebase provider or CI/CD configuration changes are required.
