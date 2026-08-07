# Child pickup Daycare offering guard

## Change

- Kept the business-rule boundary that pickup authorization is a Daycare-only
  operation.
- Hid the Staff Admin and Parent pickup entry points unless the child's own
  branch has a `PUBLISHED` offering with `DAYCARE_OPERATIONS`.
- Made the pickup route fail closed after resolving the child's branch context.
- Enforced the same branch-offering check for pickup list, create, activate,
  revoke, and checkout verification in the API.
- Removed inactive-membership read access to pickup authorization history.

## Affected behavior

- A Daycare offering in a different branch, or an aggregate tenant capability,
  no longer authorizes pickup actions for this child.
- Emergency contacts remain available because they are a shared child-safety
  resource, not a Daycare pickup capability.

## Verification

- Added unit coverage for the branch-specific mobile capability helper.
- Added API coverage that checkout rejects when the child's branch has no
  published Daycare offering.

## Follow-up

- Other legacy Daycare modules still use tenant-level compatibility gates and
  should be migrated to branch/offering scope only when their individual data
  contracts carry the necessary branch and offering context.
