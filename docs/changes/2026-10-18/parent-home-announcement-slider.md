<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Parent Home announcement slider

## Change

- Parent Home aggregates the signed-in Parent's published, recipient-scoped announcements from each active Parent tenant with an operational subscription using the existing tenant-specific API query.
- Announcements are sorted newest-first and shown as swipeable banners only when the aggregate list is non-empty. Each banner carries its source tenant and opens that tenant's announcement list without changing the active tenant.
- Parent announcement routing validates that the requested tenant is an active Parent membership. The existing server-side recipient authorization remains authoritative.
- Updated `docs/business-rules.md` §1 and the README product summary to document this Home behavior.

## Verification

- Test-first: `corepack pnpm --filter @daycare/app test -- src/home/parentHomeSummary.test.ts` failed on the missing aggregation helper as expected.
- Test-first: `corepack pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs src/home/ParentAnnouncementSlider.ui.test.tsx --runInBand` failed because the new slider component did not yet exist, as expected.
- Green: mobile Vitest suite passed, 60 files / 243 tests.
- Green: focused slider UI test passed, 1 suite / 2 tests, including empty-list hiding and tenant-context navigation.
- Green: mobile TypeScript check passed.
- Green: mobile lint completed with 0 errors; 14 warnings remain in unrelated existing files.
- `git diff --check` passed.

## Follow-up

- No backend or database change was needed; existing API returns only published announcements addressed to the current Parent.
- Clarification: the Home promotion carousel and tenant-announcement popup are distinct image-only carousels with separate data sources. Both auto-advance and show dots; the popup has a close X (and acknowledgement control only when a record requires it). New tenant announcements do not collect a message field; legacy `body` remains API/DB-compatible.

## Banner image fitting

- Parent Home promotion images use React Native `cover` fitting so the image fills the banner container edge-to-edge; source edges may be cropped to match the container's aspect ratio. Other `FallbackImage` usages retain their existing behavior.
- Test-first: focused `ParentPromotionSlider.ui.test.tsx` failed when the test expected `cover` but the component still used `contain`.
- Green: `corepack pnpm --filter @daycare/app test:ui -- src/home/ParentPromotionSlider.ui.test.tsx --runInBand` passed (12 tests).
- `git diff --check` passed.
