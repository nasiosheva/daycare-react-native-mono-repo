# pnpm GitHub Actions runtime upgrade

## Change

- Updated `pnpm/action-setup` from v4 to v6 in the pull-request and production deployment workflows.
- Kept pnpm 10.12.1 and Node 20 as the project's package-manager and build runtime; only the action's own deprecated runtime is upgraded.

## Affected behavior

- Pull-request tests and production web deployment retain the same installation, cache, test, build, and deploy steps.
- The GitHub Actions Node 20 runtime deprecation warning from `pnpm/action-setup@v4` is removed on subsequent runs.

## Verification

- Confirm both workflow files reference `pnpm/action-setup@v6`.
- Run the corresponding GitHub Actions workflow after the change is merged.

## Follow-up

- None.
