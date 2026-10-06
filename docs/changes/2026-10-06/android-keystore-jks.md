# Android release keystore extension

## Change

The local Android release signing keystore is now named
`apps/mobile/android/app/release.jks`. `MYAPP_RELEASE_STORE_FILE` and the
release-signing guide point to the new name. The keystore contents and signing
alias are unchanged, so release updates retain the same signing identity.

The file remains ignored and local-only; no keystore or password is added to
Git.

## Verification

- Confirmed `apps/mobile/android/app/release.jks` exists.
- Confirmed `MYAPP_RELEASE_STORE_FILE=release.jks`.
- Confirmed the old `release.keystore` path is no longer present.
