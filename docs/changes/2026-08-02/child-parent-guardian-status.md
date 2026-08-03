# Child Parent guardian status

## Context

Direct/offline child registration may leave a child without a linked Parent. The existing direct-link endpoint also needed to reject an existing account that was not globally registered as a Parent, without changing legacy data automatically.

## Change

- New guardian links accept only `registrationRole=PARENT` accounts.
- Staff Admin Children adds server-scoped `LINKED`, `UNLINKED`, and `REVIEW_REQUIRED` status. The latter preserves legacy links whose account is missing or is not a registered Parent.
- The Child filter sheet can filter all three statuses. It remains a draft until **OK** and the same filter is forwarded to the server-built child export.
- Child detail warns Staff Admin about a legacy non-Parent link. Manual unlink still removes only the guardian relation, never the membership.
- No invitation, Parent-account creation, enrollment, invoice, entitlement, or automatic legacy cleanup is performed.

## Verification

- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (116 workspace tests)
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) apps/api/gradlew -p apps/api test --no-daemon`
