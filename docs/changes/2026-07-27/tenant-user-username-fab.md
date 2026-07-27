# Tenant user username and floating action

## Change

- Moved the Staff Admin create-account action on **Akun tenant** to the shared floating action button.
- Added an optional username field to the Staff Admin/Staff account form and the `POST /api/v1/tenant-users` contract.
- The API now forwards the optional username to the existing tenant-account service, which already normalizes it and rejects a globally registered username.
- Added the shared, accessible `ToggleSwitch` UI component and use it for the two optional Staff permissions in the create-account form.
- Returned each account's stored username in the tenant-user response and render it in the account list.
- Localized blank and duplicate username validation errors in the API.
- Replaced account-form, invitation, account-action, and account-list loading errors with accessible inline messages. Success confirmations remain separate from error feedback.
- Added the tenant-scoped `PATCH /tenant-users/{userId}` flow and an inline edit sheet for active `STAFF` accounts.
- Added `docs/tenant-staff-accounts.md` as the detailed module reference for identity versus membership ownership, authorization, lifecycle, UI states, API payloads, localized errors, and verification.

## Behavior

- Name, email, and password remain required; username is optional.
- When supplied, the new Staff Admin or Staff member can sign in with either email or username and the same application password.
- Parent invitation remains a separate inline action because it is an invitation workflow, not direct Staff-account provisioning.
- Child-program and development-category permissions remain disabled by default and can be enabled independently with their switches.
- A Staff Admin can verify the configured username directly from the tenant-account list.
- Editing a field or choosing a Staff role/branch clears the related inline validation error, so a corrected submission has no stale feedback.
- The edit sheet can change display name, email, username (including clearing it), active branch, and both Staff permissions. It cannot change role or password.

## Verification

- API unit coverage verifies forwarding the optional username during Staff-account creation.
- API-client coverage verifies that the username is serialized to the tenant-user endpoint.
- Service and exception-handler coverage verify username response mapping and the localized duplicate-username error.
- Mobile type-check verifies the inline feedback state and rendering contract.
- API-client coverage verifies the tenant-scoped Staff update request; account-service coverage verifies that an account can retain its own existing email and username while being updated.
