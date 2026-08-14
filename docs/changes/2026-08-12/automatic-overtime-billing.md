# Automatic overtime billing

## Change

- Added an opt-in, per-branch automatic overtime-billing rule. It is disabled by default and requires valid overtime tiers.
- The rule creates one pending invoice only after the configured post-closing grace period, while manual Staff Admin charging remains available.
- Automatic charges use the same authorization, pricing, tier snapshot, idempotency, notification, correction, and void boundaries as manual charges. To avoid charging the wrong person, automatic charging requires exactly one active linked Parent; otherwise it fails closed.

## Verification

- `corepack pnpm typecheck` passed.
- `corepack pnpm test` passed (74 mobile tests plus shared workspace tests).
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) apps/api/gradlew -p apps/api test --no-daemon` passed (167 tests; 4 skipped), including automatic overtime invoice creation after the enabled grace period.
