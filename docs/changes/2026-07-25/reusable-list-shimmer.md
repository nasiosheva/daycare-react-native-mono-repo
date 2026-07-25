# Reusable list shimmer

## Change

- Added `Shimmer` and `ShimmerList` to the shared UI package.
- Replaced collection-list loading states with the shared skeleton across role homes, operational lists, administration lists, and list bottom sheets.
- List refetches, server-side search changes, and branch-filter changes also render the skeleton until the current request settles.
- The component observes the device Reduce Motion preference and uses a static skeleton when animation is disabled.

## Verification

- `corepack pnpm verify`
- `git diff --check`

## Follow-up

- Detail-page, form-selector, and submit-action loading behavior remains unchanged because it is not a collection-list state.
