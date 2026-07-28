# Staff Operations card navigation

## Change

- Replaced the trailing-arrow-only interaction in Staff Operations with the shared `NavigationCard`.
- The entire Attendance, Children, and Development card body now opens its existing destination.

## Affected behavior

- Routes and Staff-only access rules are unchanged.
- Each card remains exposed to assistive technology as one button using its title as the accessibility label.

## Verification

- Mobile TypeScript typecheck should pass after the shared card replacement.

## Follow-up

- None.
