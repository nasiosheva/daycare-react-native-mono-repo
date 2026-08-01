# Atomic daily Goal check-ins

## Change

- The Goals screen now stages each Yes/No selection locally. **Simpan hasil hari ini** is disabled until Staff has changed a result and all active indicators have a result.
- The save action sends every active indicator for that Goal and day to `PUT /child-goals/{goalId}/check-ins/{date}/batch` in one transaction. The existing single-indicator endpoint remains for amending a saved check-in's outcome, note, photo, or audio.
- The API rejects an empty, partial, duplicate, or out-of-Goal batch before any result is persisted. It publishes one Goal realtime invalidation after a successful batch.
- **Simpulkan Goal** remains separate: it closes the Goal and requires its existing final outcome and Staff summary; it does not save a daily draft.

## Verification

- `corepack pnpm verify` passed.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.GoalServiceTest --no-daemon` passed with coverage for a complete batch and a rejected partial batch.
- `./apps/api/gradlew -p apps/api test --no-daemon` passed.

## Follow-up

- Draf only lives in the current Goals screen. It is deliberately not persisted or shown to Parent until the batch save succeeds.
