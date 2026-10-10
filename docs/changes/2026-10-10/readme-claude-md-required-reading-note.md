# README note: CLAUDE.md is required reading and must not be deleted

## Change

Added a short callout to `README.md`, next to the existing "Required project
context" note for `docs/business-rules.md`, stating that `CLAUDE.md` at the
repository root is required reading for Claude Code (and any other AI coding
agent) before working in this repository, and that being listed in
`.gitignore` only means it must not be committed — the file itself must
always exist locally and must never be deleted. If it goes missing, it
should be restored before continuing non-trivial work.

## Context

`CLAUDE.md` was untracked from git in PR #74 (`chore: ignore local Claude
guidance`) and added to `.gitignore`, which is intentional — it stays a
local-only file. It was found missing from this checkout; the last
git-tracked version (from immediately before PR #74) was recovered from
history and restored, then updated with the authoring-watermark rule from
`docs/changes/2026-10-10/claude-watermark-policy.md` (also missing from the
untracked `CLAUDE.md`, confirmed committed by the same repository author
and applied with the user's explicit confirmation).

## Verification

Documentation-only change (`README.md`). No code, API contract, or
verification command is affected; `pnpm verify` is not required for this
change.

## Follow-up

None. `CLAUDE.md` itself is intentionally not part of this change set since
it is gitignored and never committed.

// Mories Deo Hutapea,S.E.,S.Kom
