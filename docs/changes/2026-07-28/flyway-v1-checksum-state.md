# Flyway V1 checksum state

## Change

- The current branch contains a one-line trailing-whitespace removal in the already-applied `V1__initial_schema.sql` migration.
- This documentation records the branch state only; it does not claim that editing an applied Flyway migration is safe or recommended.

## Affected behavior

- A database whose `flyway_schema_history` contains the checksum from the prior V1 file fails Flyway validation during API startup.
- A fresh database uses the current V1 content, while an existing local database requires either a schema-history repair or recreation before it can start with this worktree.
- Shared and production databases must not be repaired merely to bypass this warning. The SQL difference must first be reviewed and approved.

## Verification

- The local startup log reports a V1 migration checksum mismatch before Spring finishes initialization when the database stores the earlier checksum.

## Follow-up

- Restore the original V1 content or formally approve the migration-history repair path before this branch is deployed to a shared environment.
