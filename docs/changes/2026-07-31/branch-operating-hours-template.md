# Branch operating-hours template

## Change

Added two draft templates to the Staff Admin branch operating-hours screen. Selecting one immediately replaces the full weekly draft: Monday through Saturday active and Sunday closed, at either 06:00–13:30 or 07:00–16:00. Applying a template does not call the API; the Staff Admin can still edit every day and must select Save to persist the configuration.

## Affected behavior

The existing operating-hours payload shape and overtime-rate pricing behavior are unchanged.

The endpoint now accepts an empty overtime-rate list, so Staff Admin can remove the final block. Overtime invoice creation remains blocked until at least one valid block is configured.

The update transaction now flushes deleted hours and tiers before inserting their replacements, preventing the unique branch/day and branch/display-order constraints from turning a valid save into a server error.

## Verification

- `corepack pnpm verify`
- Manual: select each template, confirm it replaces every daily value, adjust its values, and save the resulting weekly configuration.
- Manual: remove the only overtime block, save the empty list, add a block again, and save it.
