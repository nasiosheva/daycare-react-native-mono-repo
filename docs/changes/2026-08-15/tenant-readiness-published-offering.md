# Tenant readiness requires a published offering

## Change

- A tenant is now `NEEDS_ATTENTION` until it has at least one explicitly
  `PUBLISHED` `EducationOffering`.
- The Staff Admin setup checklist and the **Jenis lembaga/Penawaran** menu show
  this prerequisite and route directly to offering management.
- Creating or changing an offering invalidates the tenant readiness query so
  the checklist refreshes when Staff Admin returns to Home.

## Rationale

Creating a tenant records its institution-type eligibility only. It must not
silently select a branch, enrollment mode, or publish an offering. Requiring an
explicitly published offering makes the next operational action visible without
making a tenant available to Parent prematurely.

## Verification

- Backend readiness tests cover tenants without an offering and a fully
  configured published Daycare offering.
- Mobile checklist unit test verifies the offering prerequisite is actionable
  before downstream configuration.

## Follow-up

- No migration is required; this is a derived readiness status over existing
  offering data.
