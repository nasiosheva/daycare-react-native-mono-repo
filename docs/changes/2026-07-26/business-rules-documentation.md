# Business rules documentation

## Change

- Added `docs/business-rules.md` as the canonical cross-module business-rule reference.
- Made reading the document mandatory from `README.md` before business-flow, contract, data-model, authorization, or architecture work.
- Added an `AGENTS.md` guardrail requiring both `README.md` and `docs/business-rules.md` to be read before any repository action, with mandatory user clarification when a request, implementation, memory, or document contains different business logic.
- Defined the target Platform Knowledge model using the current UI domains: tenant Curriculum Programs and tenant Goal Templates feed anonymized aggregation, configurable majority thresholds, Admin-reviewed candidates, and safe global publication.
- Clarified that the current UI has no single Learning Plan assignment: Curriculum Programs, free-form Child Programs, and Child Goals have separate ownership and permissions.

## Coverage

- Tenant and role boundaries, Parent enrollment and payment, booking and attendance, Staff scope, learning structure, curriculum and Goals, Platform Knowledge, notifications, data lifecycle, and documentation maintenance.

## Affected behavior

- This is a documentation and architecture-decision change only. Global Curriculum Programs remain directly visible and linkable by tenants without a tenant snapshot.
- A future implementation must add knowledge aggregation, candidate review, and publication UI before Platform Knowledge can be considered active.

## Verification

- Reviewed the rules against the current README, project memory, backend service boundaries, and existing documented flows.
- Compared the documented learning flow against the current Global Curriculum, Curriculum Programs, Child Detail, Goals, and tenant-permission UI.
- Confirmed the Platform Knowledge pipeline remains explicitly marked as unavailable instead of being presented as current UI.
- Confirmed the agent guardrail covers exploration, planning, review, implementation, and command execution instead of only code changes.
- Confirmed Child Program permission and Goal assignment are documented as separate UI flows.
