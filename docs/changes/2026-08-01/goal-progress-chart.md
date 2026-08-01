# Goal progress chart

## Change

- Every Child Goal now renders a read-only chart for authorized Staff and the linked Parent.
- The line is the cumulative `YES` percentage. Daily points show a complete daily `YES` or `NO` result; a day without all active indicator results is deliberately rendered as a gap.
- The chart uses the existing Child Goal response only. It does not add an assessment, score, endpoint, migration, or Platform Knowledge input.

## Verification

- `corepack pnpm verify`

## Follow-up

- The chart uses the Goal's current active-indicator set, matching the existing backend progress calculation.
