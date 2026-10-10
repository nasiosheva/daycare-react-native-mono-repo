# Watermark policy update — 2026-10-10

## Change

`CLAUDE.md` now defines the canonical author watermark:

`Mories Deo Hutapea,S.E.,S.Kom`

The rule applies to new or modified files when the format has a safe comment or
supported metadata location. Binary, generated, dependency/lock, secret,
credential, local-account, and runtime-log artifacts remain excluded so the
watermark cannot corrupt schemas, builds, or sensitive data.

## Verification

- Confirmed the rule is recorded in `CLAUDE.md`.
- Confirmed the exact spelling and punctuation are preserved.
- No README update is materially needed because this changes repository authoring
  guidance only; it does not change product behavior, API contracts, runtime
  configuration, or verification commands.
