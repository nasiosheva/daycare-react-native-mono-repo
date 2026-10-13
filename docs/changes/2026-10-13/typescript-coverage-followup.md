// Mories Deo Hutapea,S.E.,S.Kom
# TypeScript coverage follow-up

## Scope

Expanded behavior-focused tests for API client transport and endpoint wrappers, shared UI controls, tenant aggregation, child-management hooks, push registration, and realtime connection lifecycle. The API wrapper tests exposed and fixed a real header-composition bug: creating an idempotent child-care log with a tenant override could lose the `X-Organization-Id` header. The request now preserves both tenant scope and `Idempotency-Key`.

## Coverage

| Workspace | Before | After |
| --- | --- | --- |
| `@daycare/core` branches | 66.67% | 100.00% |
| `@daycare/api-client` statements / branches / functions | 89.85% / 81.88% / 22.82% | 100.00% / 94.72% / 90.39% |
| `@daycare/ui` statements / branches / functions | 23.48% / 85.36% / 65.71% | 58.34% / 92.68% / 80.43% |
| `@daycare/app` statements / branches / functions | 22.89% / 70.63% / 46.70% | 27.28% / 76.47% / 53.50% |

Realtime connection tests cover token/profile gating, tenant-scoped CONNECT, profile revalidation before event processing, web and mobile notification dispatch, cleanup, and reconnect backoff. Child-management hook tests cover tenant-scoped queries and mutations plus query-cache invalidation. The mobile workspace aggregate remains below 90% because route screens and native/platform adapters are mostly outside current unit-test coverage; coverage is reported honestly rather than hiding those files or adding assertion-only tests.

## Verification

- `corepack pnpm verify` — lint, typecheck, and 322 tests passed across 66 test files.
- `corepack pnpm -r --if-present typecheck` — all four TypeScript workspace projects passed.
- `corepack pnpm -r --if-present test:coverage` — completed; workspace coverage is reflected in the table and README.
- `corepack pnpm --filter @daycare/app test:ui` — 17 tests passed across 4 suites.
- `corepack pnpm -r --if-present lint` — passed across all TypeScript workspaces.
- `git diff --check` — passed.
