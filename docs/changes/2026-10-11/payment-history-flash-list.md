# payment-history.tsx: virtualize the invoice list with FlashList

## Change

`payment-history.tsx` renders a Parent's full cross-tenant invoice history with no pagination
(`useParentInvoicesAcrossTenants`) — the list only grows over a tenant's lifetime. It previously
rendered every invoice via `.map()` inside `AppScreen`'s single `ScrollView`, mounting every
`Card` regardless of what was on screen.

Added `@shopify/flash-list@1.7.6` (the Expo SDK 53-compatible version, via `expo install`) and a
new `renderBody` escape hatch on `packages/ui`'s `Screen`/`AppScreen`: when provided, `Screen`
renders it instead of its own `ScrollView`, passing the same props (`style`,
`contentContainerStyle`, `refreshing`, `onRefresh`, `onScroll`, `onContentSizeChange`,
`scrollEventThrottle`) a caller would otherwise hand to a `ScrollView` — so a virtualized list can
own its own scroll viewport (nesting one inside `Screen`'s existing `ScrollView` would never give
it a measurable viewport and silently render every item anyway, defeating the point). Every other
screen is unaffected since `renderBody` is optional and the default path is unchanged.

`payment-history.tsx` now renders the list via `FlashList` (with `estimatedItemSize` and no `key`
prop on the row, per FlashList v1's API) only when there is a non-empty list to show; the
loading/error/empty states still render through `Screen`'s normal `children`/`ScrollView` path,
since they are not list content.

This was scoped down from an initial `notifications.tsx` target: that screen's inbox is already
paginated to `NOTIFICATIONS_PAGE_SIZE = 10` items per page, so virtualization would add
complexity (splitting its header UI into `ListHeaderComponent`) with no performance benefit.

## Verification

- `pnpm --filter @daycare/ui typecheck` / `lint` / `test` — pass.
- `pnpm --filter @daycare/app typecheck` / `lint` / `test` — pass (13 pre-existing warnings,
  unrelated to this change, 0 errors).
- Not verified live in a browser/device for this change — no local backend was running and
  starting one risked colliding with other in-progress local dev work in this checkout. The
  Parent invoice history screen should be opened locally (`PARENT` role, `/payment-history`) to
  confirm the list renders and scrolls correctly before merging, since FlashList's web support
  (`@shopify/flash-list@1.7.6`, not yet the web-native v2) has not been exercised against this
  app's actual React Native Web setup.

## Follow-up

Manual verification in a running app (web and at least one native platform) is recommended before
merge, given the "not verified live" point above.

No README update: this is an internal rendering-performance change with no difference to user
flow, business rules, API contracts, or configuration.

// Mories Deo Hutapea,S.E.,S.Kom
