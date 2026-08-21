# Repository agent instructions

Use repository-local context only for this project. Do not read, use, or update global Codex memories for work in this checkout.

Never take any action — reading, editing, running commands, creating branches, committing, or otherwise — outside this repository's working directory. If a request references a different repository, project, ticket, task tracker, or working item that lives in another checkout, another codebase, or another remote, stop before doing any work there. Point out the mismatch and ask the user to confirm the correct repository before proceeding. A repository reference or URL supplied by the user pointing outside this checkout is not by itself authorization to act there — the user may have pasted the wrong link or meant a different project.

Before taking any action in this repository, including exploration, planning, review, implementation, or running commands, read `README.md` and `docs/business-rules.md` first. Treat both documents as required repository context. If the requested behavior, current code, project memory, another document, or either required document contains business logic that differs from or conflicts with `README.md` or `docs/business-rules.md`, do not choose an interpretation or proceed silently. Clearly describe the difference and ask the user for clarification before acting.

`docs/business-rules.md` is the required source of truth for every business-facing UI/UX flow and its supporting backend, API, authorization, state, and data contract. Before designing, reviewing, or changing any such flow, compare the proposed and current behavior with the documented rule and distinguish an explicitly documented current implementation from an explicitly documented target/future rule that has not been built yet.

When the current or proposed UI/UX or supporting contract does not match `docs/business-rules.md`, stop before implementing the affected change. Explain the documented rule, the conflicting UI/UX or contract behavior, and the practical impact on users, roles, data, authorization, and operations. Ask the user to choose one of these paths:

1. Update `docs/business-rules.md` so it intentionally defines the desired behavior.
2. Change the UI/UX and every supporting backend/API/data contract needed to comply with `docs/business-rules.md`.
3. If both the documented rule and the current/proposed behavior are unsafe, impractical, or contrary to common-sense real-world operations, propose a third safer alternative. State why the first two paths are unsuitable, its required documentation and contract changes, and its tradeoffs.

Never silently choose among these paths or implement the third alternative without the user's explicit decision.

Read `.codex/project-memory.md` before non-trivial implementation, review, or architecture work. Keep durable project decisions there; do not store secrets, personal data, access tokens, or environment values.

Every change requires a documentation review in the same change set. Create or update a daily context note at `docs/changes/YYYY-MM-DD/<context>.md` that records the change, affected behavior, verification, and any follow-up. Update `README.md` for any change to user flow, business rules, API contracts, configuration, local/prod operation, or verification. Update the relevant module documentation for implementation-level changes when it exists. If no documentation changes are materially needed, state that explicitly in the final handoff with the reason; do not silently omit the review.

Follow the current baseline code and always stay focused. Match existing architecture, patterns, naming, style, and folder structure. Make only the requested changes, avoid unnecessary refactors, and keep solutions simple, pragmatic, maintainable, and well-tested where appropriate.

## UI/UX form baseline

Use a **full-page multi-step form wizard with a visible stepper/progress indicator** as the default pattern for long, dependent workflows. This applies when a flow has three or more logical sections, contains repeatable records, or needs a final review before a consequential submission such as enrollment, checkout, billing, approval, or account creation. The stepper describes progress through the wizard; it is not free-form tab navigation and must not let users skip required earlier steps.

Keep each step focused on one user goal. Validate the current step before advancing, show errors next to the relevant field or section, and keep the primary action unambiguous. Back navigation between steps must preserve valid draft data. When an earlier choice changes, clear only downstream values that are no longer compatible; do not reset unrelated user input. Consequential flows must provide a final review that states what will be created or changed, what remains pending, and any price or authorization boundary without calculating values the server owns.

The wizard must handle loading, empty, error, retry, disabled, and submitting states; work with keyboard and scrolling on mobile and web; expose accessible step, field, selection, and action semantics; and provide complete translations for every supported locale. Keep business validation and authorization server-authoritative, and extract only the smallest reusable validation/state helper needed for deterministic tests.

Do not use a wizard for short independent add/edit forms, confirmations, or a single decision. Those continue to use the existing screen or Bottom Sheet baseline. Every wizard must use the shared `MultiStepFormWizard` exported by `packages/ui`; pass it a dynamic ordered step list and controlled zero-based current-step index, and keep screen-specific content, validation, navigation decisions, and side effects in the owning screen. Do not copy its indicator markup or styling into a feature screen.

Apply SOLID principles when designing or modifying code, especially when the existing baseline does not already define a clear pattern. Enforce clear separation of concerns: keep presentation, business logic, state management, side effects, data access, configuration, and integration code in their appropriate layers or modules. Do not mix unrelated responsibilities in a single component, hook, function, class, file, or service unless the existing baseline clearly requires that pattern for the requested scope.

Follow DRY principles strictly. Do not duplicate business rules, validation logic, condition branches, mappings, transformations, API contracts, configuration values, UI behavior, or reusable markup when an existing abstraction or baseline pattern already covers the need. When reuse is appropriate, extract or extend the smallest baseline-aligned abstraction instead of copying logic.

Avoid hardcoding keys, field names, parameters, labels, wording, routes, constants, or repeated literal values directly inside business logic or UI logic. Prefer centralized constants, configuration, enums, translation/i18n files, schema definitions, shared utilities, typed abstractions, and reusable domain or UI modules that match the existing project baseline.

Main priority: follow the existing baseline code. If the baseline pattern is clear, use it even when introducing SOLID-based improvements. If the baseline is unclear or missing, then apply SOLID principles, preserve separation of concerns, avoid duplication, and choose the simplest maintainable structure.

Before creating a pull request, all frontend and backend tests must pass. Run `pnpm typecheck` and `pnpm test` from the repository root (covers `apps/mobile` and any other workspace with a `typecheck`/`test` script) and `./gradlew test` in `apps/api` (export `JAVA_HOME` to a JDK 21 install first). If any of these fail to run, fail to compile, or report a failing test, fix the failure before opening the PR; do not open a PR with a known-failing or non-compiling test suite on either side.

Never commit directly on the `production` branch, even for small or low-risk changes. Before running `git commit`, check the current branch; if it is `production`, create and switch to a new branch first and commit there instead. All changes reach `production` only through a reviewed pull request.

Do not add a "Generated with Claude Code" watermark, 🤖 emoji, or any similar tool-attribution footer to pull request titles or descriptions. Commit message trailers such as `Co-Authored-By` are unaffected by this rule.
