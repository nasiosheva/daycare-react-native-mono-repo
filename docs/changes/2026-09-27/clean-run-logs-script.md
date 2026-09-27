# Run log cleanup script

## Change

- Added `scripts/clean-run-logs.sh` to remove every `.txt` session log under the repository's `run-logs/` directory.
- Added the command to the repository launcher documentation.

## Affected behavior

- The script is limited to regular `.txt` files inside `run-logs/`; it does not remove other file types or files outside the repository.
- Missing `run-logs/` is treated as an empty cleanup and exits successfully.

## Verification

- Shell syntax checked with `sh -n`.
- Confirmed existing `.txt` session logs remain present because the cleanup command was not executed during implementation.
