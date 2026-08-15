# Development entry media viewer fixes

## Change

- Photos attached to a development entry through the current multi-media flow (`entry.media`) can now be opened full-size in a `BottomSheet`, matching the legacy single-photo (`entry.hasPhoto`) viewer. Previously they were only ever shown as a fixed 88×88 thumbnail with no way to enlarge them, because the legacy `hasPhoto` full-size viewer only covers `entry.photoData`, a field the current save flow never populates (it always writes to `media` instead).
- Audio playback across a child's development history is now mutually exclusive: `DevelopmentHistory` tracks which media id is currently active, and each `DevelopmentMediaItem` pauses itself when a different item becomes active. Previously each item held its own independent `expo-audio` player with no coordination, so playing audio on two different entries could overlap.

## Verification

- `tsc --noEmit` passed for the mobile app.
- `expo lint` shows no new issues in `apps/mobile/app/development.tsx` (the two `import/no-unresolved` errors reported for this file are pre-existing and unrelated to this change).
