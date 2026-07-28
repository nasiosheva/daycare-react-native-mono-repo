# Initial Staff Admin username

## Change

- Added an optional username input to the first Staff Admin form in `add-tenant`.
- Added `staffAdminUsername` to the platform tenant-creation request and forwards it through the existing tenant-account service.

## Affected behavior

- Tenant creation still requires the initial Staff Admin display name, email, and password.
- When supplied, the username must meet the existing two-to-one-hundred-character and globally unique account rules.
- The initial Staff Admin can sign in using either email or username with the same application password. Leaving the field blank preserves email-only sign-in.

## Verification

- The API integration tenant-creation flow now sends an initial Staff Admin username and signs in using that username.

## Follow-up

- None.
