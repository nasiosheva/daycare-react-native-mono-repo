<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Parent platform banners

## Requirements

### Requirement: Platform Admin manages global Parent banners

The system MUST allow only a Platform Admin to create and edit draft banners, publish immediately, schedule publication, and close a scheduled or published banner. A published or scheduled banner MUST NOT be editable, and banners MUST NOT be physically deleted. Each promotion MUST include an HTTPS image URL (maximum 2,048 characters); title/body are administrative metadata and MUST NOT be rendered as image-slide captions. Parent Home MUST render published promotions in a dedicated automatically advancing image carousel with dot indicators, separate from tenant announcements. Admins MUST be able to preview the Parent carousel before saving, and preview actions MUST be non-interactive. A banner MAY have an optional expiry instant; when configured, it MUST be later than the actual or scheduled publication instant.

Platform Admin MAY enable one action per banner; it MUST be disabled by default. When enabled, tapping the image MUST open either an HTTPS URL in the in-app browser or an application page from the allowlist for the selected audience. Parent destinations are (`TENANT_ANNOUNCEMENTS`, `BOOKING`, `PARENT_SCREENING`, `PARENT_ENROLLMENT`, `PRIVATE_TUTORING`, `PROFILE`); Staff Admin destinations are (`TENANT_CHILDREN`, `TENANT_SUBSCRIPTION`, `TENANT_USERS`, `TENANT_BRANCHES`, `PROFILE`). `PROFILE` is a platform-banner-only destination and MUST NOT expand the Tenant Announcement action allowlist. Only a banner with a valid configured action is clickable; otherwise it MUST be rendered as static content. Arbitrary routes, route parameters, cross-role destinations, and non-HTTPS browser targets MUST be rejected. Opening tenant announcements MUST use the Parent's active tenant context and MUST NOT work when no such context exists.

#### Scenario: Banner action is disabled

- **WHEN** a Parent sees a published banner with action type `NONE`
- **THEN** the promotion is displayed but cannot be tapped for navigation

#### Scenario: Banner action opens an allowlisted destination

- **WHEN** a Parent taps a published banner configured with a valid browser or allowlisted app-page target
- **THEN** the app opens only the configured safe destination

#### Scenario: Non-admin attempts banner management

- **WHEN** an authenticated non-Platform Admin requests a management endpoint
- **THEN** the request is denied

#### Scenario: Scheduled banner reaches its publication time

- **WHEN** a scheduled banner's time is due
- **THEN** it changes to `PUBLISHED` and is returned by the Parent feed

#### Scenario: Expired banner is hidden and closed

- **WHEN** a scheduled or published banner reaches its expiry instant
- **THEN** the Parent feed immediately excludes it and the scheduled lifecycle job changes it to `CLOSED`

#### Scenario: Expiry precedes publication

- **WHEN** an admin configures expiry at or before the actual or scheduled publication instant
- **THEN** the system rejects the request

#### Scenario: Scheduled publication time is in the past

- **WHEN** an admin supplies a scheduled publication timestamp at or before the current instant
- **THEN** the system rejects the request instead of publishing immediately

#### Scenario: A scheduled banner is closed

- **WHEN** an admin closes a scheduled banner or its expiry is reached before publication
- **THEN** it changes to `CLOSED`, clears the pending `scheduledAt`, and retains its closure timestamp

#### Scenario: Admin previews a configured action

- **WHEN** a Platform Admin previews a draft with an enabled action
- **THEN** the slider matches Parent presentation but does not navigate when tapped

### Requirement: Parent reads platform-wide banners

The system MUST allow an authenticated registered Parent to read published global banners regardless of tenant membership, tenant subscription, or child linkage. The Parent feed MUST exclude draft, scheduled, and closed banners.

#### Scenario: Parent has no tenant membership

- **WHEN** a registered Parent with no tenant membership requests the global feed
- **THEN** the Parent receives currently published banners

#### Scenario: Parent feed does not return expired banners

- **WHEN** a published banner has reached its expiry instant but the periodic lifecycle job has not yet run
- **THEN** the Parent feed excludes that banner

### Requirement: Tenant announcements use a recipient-scoped popup slider

New tenant announcements MUST require an HTTPS image URL (maximum 2,048 characters) and MUST NOT require a message/body field in the creation UI. Legacy announcement body data remains backward-compatible; body may be empty, and legacy text-only announcements MUST NOT appear in the image popup. Parent Home MUST present published image announcements addressed to that Parent in an automatically advancing popup carousel with dot indicators, separate from global promotions. The popup MUST render only the image (with an accessible label), use authorized recipient data, and preserve tenant context for acknowledgement or navigation. A remote image load failure MUST render an accessible fallback. The popup MUST provide an accessible close-all X control; dismissing MUST NOT update server-side acknowledgement state.

#### Scenario: Parent dismisses the popup

- **WHEN** a Parent activates the popup close control
- **THEN** every announcement slide is hidden for the current Home visit without changing server-side acknowledgement

#### Scenario: Announcement image cannot load

- **WHEN** a remote announcement image fails to load
- **THEN** an accessible image-unavailable placeholder is shown and the announcement content remains usable

### Requirement: Tenant announcements may have an optional safe action

Staff Admin MUST be able to leave the Parent action disabled (the default), or configure one explicit action: open an HTTPS URL in the browser, or open an application page from the supported allowlist (`TENANT_ANNOUNCEMENTS`, `BOOKING`, `PARENT_SCREENING`, `PARENT_ENROLLMENT`, `PRIVATE_TUTORING`). When enabled, tapping the image MUST open the configured safe destination; otherwise the image MUST be non-clickable. Arbitrary route strings, route parameters, and non-HTTPS browser targets MUST be rejected. Required acknowledgement remains an independent action.

#### Scenario: Announcement has no configured action

- **WHEN** a Parent sees an announcement whose action type is `NONE`
- **THEN** the image is not clickable and dismiss/acknowledgement behavior remains available

#### Scenario: Announcement opens an application page

- **WHEN** a Parent selects a configured application-page CTA
- **THEN** the app navigates only to the matching allowlisted page and preserves tenant context only where that destination uses it
