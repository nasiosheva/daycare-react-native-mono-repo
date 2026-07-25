# Staff fixed-child flow

## Change

- Selecting a child from Staff Home now locks Development to that child instead of rendering the child switcher.
- Entering that child's Goals keeps the same lock and does not expose another child selector.
- A stale fixed child route does not fall back to another child, preventing accidental work on the wrong child.
- Development history is rendered inline in the same child flow for Staff, Staff Admin, and Parent, grouped by category.

## Verification

- Extended the selected-child unit tests to cover a stale, locked route.
- Mobile typecheck covers the shared inline-history component.
- Added a unit test for stable category grouping and per-category entry order.
