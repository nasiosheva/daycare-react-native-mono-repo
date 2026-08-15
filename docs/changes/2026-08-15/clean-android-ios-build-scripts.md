# Clean Android/iOS build scripts

## Change

- Added `scripts/clean-android-build.sh`: runs `./gradlew clean` in `apps/mobile/android` (when present), then removes `build`, `app/build`, `app/.cxx`, `.gradle`, and `.kotlin` so a stale native build/cache can't cause confusing failures.
- Added `scripts/clean-ios-build.sh`: removes `build` and `Pods` under `apps/mobile/ios` (when present), and removes only this project's `~/Library/Developer/Xcode/DerivedData/<ProjectName>-*` entries (matched by the `.xcodeproj` name), leaving other Xcode projects' caches untouched.
- Both scripts only remove build/cache directories; they do not run `pod deintegrate` or touch `Podfile.lock`.
- `apps/mobile/android` and `apps/mobile/ios` are both gitignored, generated-only directories (via `expo prebuild`), so nothing tracked in git is affected by either script.

## Verification

- `sh -n` syntax check passed for both scripts.
- Ran `scripts/clean-android-build.sh` for real against this checkout's native Android project: `./gradlew clean` completed (`BUILD SUCCESSFUL`), then the remaining cache/build directories were removed, freeing roughly 3.3 GB.
- Ran `scripts/clean-ios-build.sh` for real: correctly found and removed only this project's `DerivedData/UmurEmas-*` entry, leaving other projects' `DerivedData` entries in place.
