# Repository agent instructions

Use repository-local context only for this project. Do not read, use, or update global Codex memories for work in this checkout.

Before taking any action in this repository, including exploration, planning, review, implementation, or running commands, read `README.md` and `docs/business-rules.md` first. Treat both documents as required repository context. If the requested behavior, current code, project memory, another document, or either required document contains business logic that differs from or conflicts with `README.md` or `docs/business-rules.md`, do not choose an interpretation or proceed silently. Clearly describe the difference and ask the user for clarification before acting.

Read `.codex/project-memory.md` before non-trivial implementation, review, or architecture work. Keep durable project decisions there; do not store secrets, personal data, access tokens, or environment values.

Every change requires a documentation review in the same change set. Create or update a daily context note at `docs/changes/YYYY-MM-DD/<context>.md` that records the change, affected behavior, verification, and any follow-up. Update `README.md` for any change to user flow, business rules, API contracts, configuration, local/prod operation, or verification. Update the relevant module documentation for implementation-level changes when it exists. If no documentation changes are materially needed, state that explicitly in the final handoff with the reason; do not silently omit the review.

Follow the current baseline code and always stay focused. Match existing architecture, patterns, naming, style, and folder structure. Make only the requested changes, avoid unnecessary refactors, and keep solutions simple, pragmatic, maintainable, and well-tested where appropriate.

Apply SOLID principles when designing or modifying code, especially when the existing baseline does not already define a clear pattern. Enforce clear separation of concerns: keep presentation, business logic, state management, side effects, data access, configuration, and integration code in their appropriate layers or modules. Do not mix unrelated responsibilities in a single component, hook, function, class, file, or service unless the existing baseline clearly requires that pattern for the requested scope.

Follow DRY principles strictly. Do not duplicate business rules, validation logic, condition branches, mappings, transformations, API contracts, configuration values, UI behavior, or reusable markup when an existing abstraction or baseline pattern already covers the need. When reuse is appropriate, extract or extend the smallest baseline-aligned abstraction instead of copying logic.

Avoid hardcoding keys, field names, parameters, labels, wording, routes, constants, or repeated literal values directly inside business logic or UI logic. Prefer centralized constants, configuration, enums, translation/i18n files, schema definitions, shared utilities, typed abstractions, and reusable domain or UI modules that match the existing project baseline.

Main priority: follow the existing baseline code. If the baseline pattern is clear, use it even when introducing SOLID-based improvements. If the baseline is unclear or missing, then apply SOLID principles, preserve separation of concerns, avoid duplication, and choose the simplest maintainable structure.

Before creating a pull request, all frontend and backend tests must pass. Run `pnpm typecheck` and `pnpm test` from the repository root (covers `apps/mobile` and any other workspace with a `typecheck`/`test` script) and `./gradlew test` in `apps/api` (export `JAVA_HOME` to a JDK 21 install first). If any of these fail to run, fail to compile, or report a failing test, fix the failure before opening the PR; do not open a PR with a known-failing or non-compiling test suite on either side.

Never commit directly on the `production` branch, even for small or low-risk changes. Before running `git commit`, check the current branch; if it is `production`, create and switch to a new branch first and commit there instead. All changes reach `production` only through a reviewed pull request.
