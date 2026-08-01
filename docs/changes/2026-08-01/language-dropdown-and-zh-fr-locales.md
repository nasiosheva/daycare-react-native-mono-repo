# Language selector moved to Profile dropdown; add Mandarin and French

## Context

User request: move the language switcher out of the Sign In/toolbar area into a dropdown inside `src/profile/`, and add full Mandarin (Simplified) and French translations for the whole app.

## Changes

- `apps/mobile/src/profile/LanguageSelectField.tsx` (new): a dropdown matching the existing `OptionSelectField` visual pattern (tap trigger → BottomSheet with options), but without a "clear" action since a locale is never unset. Lists all four supported locales.
- `apps/mobile/app/profile.tsx`: renders `LanguageSelectField` inside the "Data diri" card; removed the old `headerAction={<LanguageSwitcher compact />}` from the app bar.
- `apps/mobile/src/i18n/LanguageSwitcher.tsx`: deleted (no remaining usages after the above).
- `apps/mobile/src/i18n/translations.ts`: added `zh` (Simplified Chinese) and `fr` (French) to `supportedLocales` and `localeTags` (`zh-CN`, `fr-FR`), plus a flat `const zh = {...}` / `const fr = {...}` object covering all 1391 existing `TranslationKey`s (+1 new key `profile.language`), included in the exported `translations` record. Unlike the existing `id`/`en` content (spread together from ~20 small per-feature chunk constants), `zh`/`fr` are single flat objects — with 1391+ keys, that is far cheaper to generate and verify programmatically than scattering the additions across every existing chunk, and TypeScript's `Record<keyof typeof id, string>` constraint enforces complete key coverage either way.
- `apps/mobile/src/i18n/translations.test.ts`: added one assertion resolving `zh`/`fr` for an interpolated key.
- `docs/business-rules.md` §1: updated the language-switcher bullet to name `LanguageSelectField`, list all four supported locales, and state that role labels ("Staff Admin", "Parent") are intentionally left untranslated in every locale.

## How the translations were produced

Given the scale (1391 keys × 2 new languages = 2,782 strings), translation was delegated to 28 parallel subagents (50 keys each), all given the same glossary of domain terms (Goal, Tenant, Booking, Check-in/out, etc.) mapped to fixed zh/fr equivalents for consistency across batches, plus an explicit rule to leave role names untranslated and to preserve every `{placeholder}` token verbatim.

## Verification

- Merged all 28 batches programmatically: 1391/1391 keys present, 0 missing, 0 unexpected extras.
- Scripted placeholder check across all 1391 keys: 0 mismatches between the `{placeholder}` tokens in `en` vs. `zh` vs. `fr`.
- `npx tsc --noEmit -p apps/mobile` — clean; this alone proves `zh` and `fr` have exactly the same key set as `id`/`en`, since `translations: Record<AppLocale, Record<keyof typeof id, string>>` would fail to compile otherwise.
- `pnpm test` from the repo root — all packages and `apps/mobile` pass (64 tests), including the new zh/fr assertion.
- Manual spot-check of ~10 sampled keys (including ones containing "Staff Admin") for translation quality and glossary/role-name consistency — read as natural, professional app copy in both languages.
