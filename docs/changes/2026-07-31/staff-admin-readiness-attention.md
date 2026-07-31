# Staff Admin readiness attention flags

## Change

The Home **Perlu perhatian** card still opens the Staff Admin management hub. The hub now reads the current tenant readiness result and marks the corresponding management cards with a red border, an attention flag, and the exact unmet requirement. A Classroom card was added to provide the direct destination for a missing active classroom.

An inactive tenant subscription appears as a notice rather than a link because subscription lifecycle remains Platform Admin-only.

## Affected behavior

The flags cover missing active Staff Admin, branch, classroom, service plan, branch capacity, and payment instruction. They are read-only indicators; each existing card retains its normal destination and permissions.

## Verification

- `corepack pnpm verify`
- Manual: open Home as Staff Admin with each readiness issue and confirm the Home card opens **Kelola**, its matching card is visibly flagged, and the card opens the existing configuration screen.
