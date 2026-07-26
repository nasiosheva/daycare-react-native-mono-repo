# Remove the simulation environment

## Context

The repository had a whole parallel "simulation" environment: a separate Spring profile with its own database, a role-preview sign-in flow that faked a session without any Firebase token or API access, and a matching set of local launcher scripts and environment templates. The user asked to remove it entirely and cleanly, with nothing related left behind.

## Changes

- **Backend**: deleted `apps/api/src/main/kotlin/com/daycare/api/config/SimulationDataSeeder.kt` and `apps/api/src/main/resources/application-simulation.yml`. The `simulation` Spring profile no longer exists.
- **Mobile auth**: deleted `apps/mobile/src/auth/simulation.ts`. `AuthProvider.tsx` no longer tracks a `simulationSession`/`isSimulationSession`, and dropped `signInAsSimulationRole` from its context value and type. Every screen that branched on `isSimulationSession` — `sign-in.tsx` (role-preview buttons), `home.tsx` (all three role home screens), `profile.tsx`, `admin-pin.tsx`, and `RealtimeConnection.tsx` — now runs its normal Firebase/local-auth path unconditionally.
- **Config**: removed `env.isSimulation` from `apps/mobile/src/config/env.ts` (`env.isProduction` and the rest are unaffected).
- **i18n**: removed the now-unused `auth.simulation*`, `auth.orFirebase`, `home.simulation`, `profile.simulation`, `profile.passwordSimulation`, and `pin.simulation`/`pin.unavailable` keys from both locales in `translations.ts`.
- **Scripts**: deleted `run-android-simulation.sh`, `run-ios-simulation.sh`, `run-web-simulation.sh`. `scripts/run-mobile.sh` no longer accepts `simulation` as an environment argument.
- **Env files**: deleted the tracked `.env.simulation.example` template (and the local, gitignored `.env.simulation`). Removed `dev:api:simulation` from `package.json`.
- **README.md**: removed the `.env.simulation` row, the `SIMULATION_*` variable rows, the `EXPO_PUBLIC_APP_ENV` simulation wording (production-only hiding of Google/phone sign-in remains, see `docs/changes/2026-07-25/` for that feature), the entire "Simulation environment" section, and the Simulation row/`cp` line under "Mobile and web launchers".

## Not changed

`docs/changes/2026-07-25/global-goal-templates.md`, `goal-template-seed-data.md`, and `profile-details-goal-templates-and-hub-refinements.md` still describe the old simulation-based seeding as it existed on that date — per this repo's own running-log convention, historical entries are not rewritten when the feature they describe is later removed.

## Verification

- `cd apps/mobile && npx tsc --noEmit -p .` — clean.
- `pnpm --filter @daycare/app lint` — only pre-existing false-positive resolver errors (`@/date-picker/DatePicker`, `@/notify/notify`, `@/auth/rememberedCredentialsStorage`, etc.) and two pre-existing unused-variable warnings in `home.tsx` unrelated to this change; nothing new.
- `gradle compileKotlin` (apps/api, JDK 21) — `BUILD SUCCESSFUL`.
- `grep -rli simulation` across the repo (excluding `dist/`, `node_modules/`, and the historical `docs/changes/2026-07-25/` entries above) — no matches.
