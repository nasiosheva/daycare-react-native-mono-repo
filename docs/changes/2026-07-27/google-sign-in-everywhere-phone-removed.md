# Google Sign-In shown everywhere; phone sign-in removed

## Context

Earlier (2026-07-25) the Google and phone-number sign-in buttons were both hidden in the production build via `EXPO_PUBLIC_APP_ENV=production`. The user has now reversed part of that decision: Google Sign-In should be available wherever Firebase auth is active — including production — while phone-number sign-in should be dropped from the sign-in screen entirely, in any environment.

## Changes

- `apps/mobile/app/sign-in.tsx`: the sign-in buttons block changed from
  `{!env.isLocalAuth && !env.isProduction && <>Google button, Phone button</>}`
  to a single `{!env.isLocalAuth && <Google button>}`. The phone-number button and its `router.push("/verify-phone")` call were removed outright — not gated by any flag, so it no longer appears in any environment.
- `env.isProduction` (`apps/mobile/src/config/env.ts`) is now unused by any in-app logic. Kept as-is per explicit choice — reserved for a possible future production-only behavior rather than removed, so `EXPO_PUBLIC_APP_ENV` is still set by `deploy-production.yml` and `.env.prod.example`.
- `README.md`: corrected the product-capabilities bullet and the `EXPO_PUBLIC_APP_ENV` variable-table row, which both still described the old hide-in-production behavior. The row now notes its only remaining effect is being a required precondition for the Android release APK build (`docs/android-release-apk.md`), not sign-in UI.

## Not changed

- The underlying phone-auth capability (`firebaseAuth.sendPhoneCode`/`verifyPhoneCode`, `apps/mobile/app/verify-phone.tsx`) was left in place — only the sign-in screen's entry point to it was removed. If it turns out to be fully dead code, that is a separate decision.
- `EXPO_PUBLIC_APP_ENV` / `env.isProduction` infrastructure was intentionally left in the codebase per the user's explicit choice, even though nothing currently reads `env.isProduction`.

## Verification

- `cd apps/mobile && npx tsc --noEmit -p .` — clean.
- Manual: local `.env` reconfigured with real `umur-emas` Firebase web credentials and `LOCAL_AUTH_ENABLED=false` on both the mobile client and API (`FIREBASE_ISSUER_URI=https://securetoken.google.com/umur-emas`); backend restarted; user confirmed the Google button appears on `run-web-local.sh` and no longer 401s at `GET /me` after Google sign-in.
- Production Firebase/Google credentials were already present as GitHub Actions vars (`PRODUCTION_FIREBASE_*`, `PRODUCTION_GOOGLE_WEB_CLIENT_ID`) from the 2026-07-25 work; no CI/CD changes were needed for this reversal, only the client-side guard.
