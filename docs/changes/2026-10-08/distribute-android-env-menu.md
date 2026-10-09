# Distribute Android environment menu

- Changed `scripts/distribute-android.sh` so an omitted environment uses the shared arrow-key menu (`↑`/`↓` + Enter), matching the other launchers; the positional environment argument remains available for scripted use.
- Reused `scripts/lib/interactive-menu.sh` and restored terminal state on exit or interruption.
- Verification: `sh -n scripts/distribute-android.sh` passed. The Firebase build/upload path was not run because it requires interactive credentials and a release distribution action.
