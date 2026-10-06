# Chat thread initial scroll position

## Change

The child chat screen now starts at the newest message when the first thread
data is rendered. The shared `Screen` scroll container exposes
`onContentSizeChange`; `child-messages.tsx` uses it once per child/tenant thread
with a non-empty response and scrolls without animation. Existing behavior for
new incoming messages, sent messages, reply jumps, and the new-message arrow
remains unchanged.

## Verification

- `corepack pnpm --filter @daycare/app typecheck`
- `corepack pnpm --filter @daycare/app test -- --run`
- `git diff --check`
