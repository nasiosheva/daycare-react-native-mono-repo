# Development entry media viewer fixes

## Change

- Photos attached to a development entry through the current multi-media flow (`entry.media`) can now be opened full-size in a `BottomSheet`, matching the legacy single-photo (`entry.hasPhoto`) viewer. Previously they were only ever shown as a fixed 88×88 thumbnail with no way to enlarge them, because the legacy `hasPhoto` full-size viewer only covers `entry.photoData`, a field the current save flow never populates (it always writes to `media` instead).
- Audio playback across a child's development history is now mutually exclusive: `DevelopmentHistory` tracks which media id is currently active, and each `DevelopmentMediaItem` pauses itself when a different item becomes active. Previously each item held its own independent `expo-audio` player with no coordination, so playing audio on two different entries could overlap.
- Fixed `selectChild` writing the picked child into the screen's route params (`router.setParams({ childId })`). That write flipped `hasFixedChild` to `true` on the next render (it is derived from the route's `childId` param), which hides the free-pick child selector — so after picking a child once from the free-pick list (no `childId` in the route), staff could no longer switch to a different child without leaving and re-entering the screen. `selectChild` now only updates local state.
- The "Goals" shortcut button was shown for any selected child regardless of offering capability, but `goals.tsx` itself silently redirects to `/home` when the branch does not have the `ACADEMIC_CURRICULUM` offering (Goal assignment requires a Curriculum Program chain per `docs/business-rules.md` §6.3). The button is now gated on `hasAcademicOffering` (added via `useUiAccessContext`/`hasOfferingCapability`, mirroring `classrooms.tsx`), so it no longer appears where tapping it would just bounce to Home with no explanation.

## Verification

- `tsc --noEmit` passed for the mobile app.
- `expo lint` shows no new issues in `apps/mobile/app/development.tsx` (the two `import/no-unresolved` errors reported for this file are pre-existing and unrelated to this change).
