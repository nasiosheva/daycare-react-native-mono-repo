# Chat WebSocket transport

## Change

Chat messages now use the `CHILD_MESSAGES` WebSocket event as the active
transport. Sending a message no longer creates an inbox notification or a
generic `NOTIFICATIONS` realtime event. The event still refreshes an open
thread; no OS push or browser notification is emitted for chat.

Legacy chat notification rows are excluded from inbox queries, unread counts,
search, pagination, and mark-all operations without deleting database history.
Web receives realtime chat invalidation while connected but no chat inbox or
browser notification.

## Verification

- Backend unit tests cover the WebSocket default, the fail-closed Firebase
  switch, recipient scope, and the absence of persisted inbox rows.
- Mobile route/realtime checks cover the existing child-chat deep-link and the
  separation between `CHILD_MESSAGES` invalidation and `NOTIFICATIONS`.

## Follow-up

Firebase push remains a future provider. It must not be enabled until token
storage, Firebase credentials, delivery receipts, and end-to-end tests exist.
