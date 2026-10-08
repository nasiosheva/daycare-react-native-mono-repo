# Web blank/white screen: pretty-format version conflict

## Symptom

Running the mobile app for web (`./scripts/run-web.sh`) against a local
backend loaded a fully blank white page — no sign-in screen, no error UI,
nothing rendered. The backend itself was fine; the issue was isolated to
the web bundle.

## Root cause

`apps/mobile/package.json` depends on `pretty-format@29.7.0` transitively
through the Expo/Jest 29 toolchain (`jest-expo`, `@expo/metro-runtime`).
PR #71 ("Harden password reset sessions and add coverage reporting") added
`@types/jest@^30.0.0` for the new Jest UI test suite, which pulled in
`expect@30.x` → `pretty-format@30.5.1` as a second, conflicting copy inside
the pnpm workspace.

`@expo/metro-runtime`'s `HMRClient.ts` (used by the web Metro runtime at
module-load time) defends against exactly this multi-version scenario:

```ts
import prettyFormat, { plugins } from 'pretty-format';
// @ts-expect-error: Account for multiple versions of pretty-format inside of a monorepo.
const prettyFormatFunc = typeof prettyFormat === 'function' ? prettyFormat : prettyFormat.default;
```

Babel's compiled CJS/ESM interop form resolves the `pretty-format` import
binding itself to an object with a `.default` property rather than the
function directly, so `typeof prettyFormat === 'function'` is `false` and
the code falls through to `prettyFormat.default` — which, with two
different `pretty-format` copies resolved in the workspace, pointed at
`undefined`. The resulting `TypeError` happened at module-evaluation time,
before React mounted, producing a blank page with no on-screen error.

## Fix

Pinned `pretty-format` to a single version across the whole pnpm workspace
via `pnpm.overrides` in the root `package.json`:

```json
"pnpm": {
  "overrides": {
    "pretty-format": "29.7.0"
  }
}
```

Regenerated `pnpm-lock.yaml` with `corepack pnpm install`. No application
code changed; `@types/jest` and the new Jest UI test suite from PR #71 are
untouched and still work, since they only need the `pretty-format` API
surface, not a specific version.

## Verification

- `corepack pnpm install --frozen-lockfile` — lockfile consistent, single
  `pretty-format@29.7.0` resolved workspace-wide.
- `pnpm verify` (lint + typecheck + test across every TS workspace) — all
  green.
- Live reproduction in a real Chrome session against a local backend:
  before the fix, the web app loaded blank with the `TypeError` described
  above in the console; after the fix, the same load renders the sign-in
  screen normally with no console error.

## Follow-up

None. This is a dependency-resolution fix only.
