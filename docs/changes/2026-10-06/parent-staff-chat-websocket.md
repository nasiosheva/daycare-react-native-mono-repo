# Parent–Staff chat over realtime WebSocket

## Scope

Parent, Staff, and Staff Admin continue to use the existing append-only
per-child message thread. This change makes its realtime delivery explicit:
the REST endpoint persists and authorizes the message, then the server sends a
tenant-scoped `CHILD_MESSAGES` WebSocket event to the intended other side.

## Safety contract

- The WebSocket event contains only `childId` and `messageId`; it never carries
  message text, sender names, or other child data.
- The client treats the event as an invalidation hint and refetches only the
  affected thread through the protected REST endpoint. A reconnect or missed
  event cannot lose persisted messages.
- Recipient selection remains unchanged: Parent messages go to assigned Staff,
  or active Staff Admins only when no Staff is assigned; Staff/Staff Admin
  messages go to linked guardians.
- Tenant and child-scope checks still run on every REST read/send operation.

## Verification

The ChildMessageService and realtime query-invalidation tests verify both
persisted notification delivery and the identifier-only WebSocket event for
Parent → Staff Admin/Staff and Staff → Parent flows.
