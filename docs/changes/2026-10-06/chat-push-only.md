# Chat push-only notifications

## Change

Chat messages now use an ephemeral native push path. Sending a message no longer
creates an inbox notification or a generic `NOTIFICATIONS` realtime event. The
existing `CHILD_MESSAGES` realtime event still refreshes an open thread, and a
tapped push opens the authorized child chat using its action path.

Legacy chat notification rows are excluded from inbox queries, unread counts,
search, pagination, and mark-all operations without deleting database history.
Web receives realtime chat invalidation while connected but no chat inbox or
browser notification.

## Verification

- Backend unit tests cover push-only delivery, muted devices, recipient scope,
  and the absence of persisted inbox rows.
- Mobile route/realtime checks cover the existing child-chat deep-link and the
  separation between `CHILD_MESSAGES` invalidation and `NOTIFICATIONS`.

## Follow-up

Physical Expo push delivery still requires a registered native device and is not
proven by local unit tests alone.
