# Umur Emas project memory

## Scope

This file is the durable, repository-local context for agents working on Umur Emas. Keep it concise and factual. Never include secrets or personal data.

## Architecture

- Monorepo: Expo/React Native application in `apps/mobile`, Kotlin/Spring Boot API in `apps/api`, shared domain rules in `packages/core`, UI primitives in `packages/ui`, and typed HTTP client in `packages/api-client`.
- The product name is **Umur Emas**. It supports web, iOS, Android, and tablet layouts.
- PostgreSQL schema changes use versioned Flyway SQL migrations under `apps/api/src/main/resources/db/migration`.
- Backend features that persist data require matching service-layer authorization, API route, API-client contract, and migration.

## Product conventions

- Supported UI languages are Indonesian and English. New visible text belongs in `apps/mobile/src/i18n/translations.ts`; API errors are localized through `Accept-Language` and the API error bundles.
- Main role layouts do not use an app bar. Child/detail screens use an app bar and a back button, and do not show the bottom navigation.
- Roles: platform `ADMIN`; tenant `STAFF_ADMIN`, `STAFF`, and `PARENT`.
- Staff Admin manages children, tenant staff, billing, subscriptions, and booking approvals. Child management supports child profiles, child programs, and staff assignments with `STAFF`, `NURSE`, or `MISS` responsibilities.

## Verification

- TypeScript/mobile: `corepack pnpm verify`.
- Spring API: set JDK 21, then run `gradle -p apps/api test --no-daemon`.
- The local PostgreSQL database may be launched with Docker Compose when Docker is installed; it is not bundled in the repository.
