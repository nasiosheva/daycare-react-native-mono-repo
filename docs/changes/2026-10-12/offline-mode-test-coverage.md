# Offline mode: full test coverage + 2 real bugs found and fixed

## Change

`apps/mobile/src/offline/` previously had tests for only `outbox.ts` (3 cases). Added coverage
for every remaining file:

- `networkSignal.test.ts` — pub/sub subscribe/unsubscribe/notify.
- `persistence.web.test.ts` — localStorage round-trip, missing-localStorage fallback.
- `persistence.native.test.ts` — SecureStore chunking round-trip (short and multi-chunk values),
  leftover-chunk cleanup on a shorter overwrite, delete, and corrupted/missing-chunk handling.
- `store.test.ts` — scope-key encoding, outbox/snapshot load-save-purge round-trips, corrupted-JSON
  fallback, snapshot expiry.
- `OfflineProvider.ui.test.tsx` — `cacheDescriptor`/`sanitizeParentProfile` (now exported, were
  module-private) plus the full `enqueueChildCareLog`/`flush` orchestration: immediate sync success,
  network-error retry-then-recover, non-retryable rejection, 409 conflict, and the Parent role gate.
- `OfflineStatusBanner.ui.test.tsx` — every status-to-message/tone mapping and the
  nothing-to-show case.

Writing the `OfflineProvider` orchestration tests surfaced two real bugs in
`apps/mobile/src/offline/OfflineProvider.tsx`, both fixed in this change (not just adjusted tests
to match the broken behavior):

1. **Outbox-restoration effect re-fired mid-flush and stomped an in-flight sync.** The effect that
   restores the persisted outbox on mount depended on `flush` and `queryClient`, but `flush`'s own
   identity changes every time `syncing`/`online` toggle — which happens *during* `flush`'s own
   execution. That made the restoration effect re-run mid-flush, re-read the (stale, pre-write)
   persisted outbox, and overwrite whatever `flush` had just written — silently discarding a
   REJECTED/CONFLICT task's status (and, in the test, the entire queued task). Fixed by calling
   `flushRef.current()` from the restoration and network/app-state effects instead of `flush`
   directly, with those effects' dependency arrays no longer including `flush` — so they only
   re-run when the scope actually changes, not on every `syncing`/`online` toggle.
2. **Reconnect auto-retry never actually fired.** The network-signal listener did
   `setOnline(nextOnline); if (nextOnline) void flush();` in the same synchronous callback — but
   `flush`'s own early-return guard read the `online`/`syncing` **state variables** closed over at
   the last render, not the just-called `setOnline(true)`, since React hadn't re-rendered yet. So
   the auto-retry-on-reconnect call always saw stale `online: false` and bailed out immediately,
   silently. Fixed by adding `onlineRef`/`syncingRef` (same pattern already used for
   `scopeRef`/`tasksRef`), updated synchronously alongside `setOnline`/`setSyncing`, with `flush`'s
   guard reading the refs instead of the state variables.

## Verification

- `pnpm --filter @daycare/app typecheck` / `lint` / `test` / `test:ui` — all pass (49 vitest files
  / 167 tests, 4 jest-expo UI suites / 17 tests).
- `pnpm verify` (full monorepo lint + typecheck + test) — passes.
- Not verified on a real device/connectivity-loss scenario; the two bugs above were only
  reproducible through the deterministic unit tests (precise control over mock timing), which is
  exactly why this module needed the coverage.

## Follow-up

None; both findings were fixed in this change, not deferred.

// Mories Deo Hutapea,S.E.,S.Kom
