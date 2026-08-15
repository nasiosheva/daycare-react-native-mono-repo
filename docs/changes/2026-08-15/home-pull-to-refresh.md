# Home pull-to-refresh

## Change

- `Screen` now accepts optional `refreshing` and `onRefresh` props and renders
  the platform-native refresh control only on Android and iOS.
- Each role-specific Home refetches its currently active, scoped query groups
  when the user pulls down: Platform Admin, Staff Admin, Staff, Parent, and
  Parent onboarding.

## Behavior and scope

- The gesture is read-only. It does not create, update, approve, publish, or
  switch tenant context.
- Disabled or inactive queries are not forced; React Query refreshes only
  mounted active queries matching the role's current scope.
- Browser Home keeps ordinary scrolling without a native pull-to-refresh
  control.

## Verification

- Typecheck covers the shared `Screen` contract and every Home call site.
- Lint and the full workspace unit-test suite run after the change.
