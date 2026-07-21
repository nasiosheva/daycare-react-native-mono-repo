# Repository agent instructions

Use repository-local context only for this project. Do not read, use, or update global Codex memories for work in this checkout.

Read `.codex/project-memory.md` before non-trivial implementation, review, or architecture work. Keep durable project decisions there; do not store secrets, personal data, access tokens, or environment values.

Follow the current baseline code and always stay focused. Match existing architecture, patterns, naming, style, and folder structure. Make only the requested changes, avoid unnecessary refactors, and keep solutions simple, pragmatic, maintainable, and well-tested where appropriate.

Apply SOLID principles when designing or modifying code, especially when the existing baseline does not already define a clear pattern. Enforce clear separation of concerns: keep presentation, business logic, state management, side effects, data access, configuration, and integration code in their appropriate layers or modules. Do not mix unrelated responsibilities in a single component, hook, function, class, file, or service unless the existing baseline clearly requires that pattern for the requested scope.

Follow DRY principles strictly. Do not duplicate business rules, validation logic, condition branches, mappings, transformations, API contracts, configuration values, UI behavior, or reusable markup when an existing abstraction or baseline pattern already covers the need. When reuse is appropriate, extract or extend the smallest baseline-aligned abstraction instead of copying logic.

Avoid hardcoding keys, field names, parameters, labels, wording, routes, constants, or repeated literal values directly inside business logic or UI logic. Prefer centralized constants, configuration, enums, translation/i18n files, schema definitions, shared utilities, typed abstractions, and reusable domain or UI modules that match the existing project baseline.

Main priority: follow the existing baseline code. If the baseline pattern is clear, use it even when introducing SOLID-based improvements. If the baseline is unclear or missing, then apply SOLID principles, preserve separation of concerns, avoid duplication, and choose the simplest maintainable structure.
