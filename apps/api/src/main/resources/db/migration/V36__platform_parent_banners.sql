-- Mories Deo Hutapea,S.E.,S.Kom
CREATE TABLE platform_banners (
    id UUID PRIMARY KEY,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    updated_by_user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(160) NOT NULL,
    body VARCHAR(4000) NOT NULL,
    image_url VARCHAR(2048) NOT NULL,
    action_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
    action_target VARCHAR(2048),
    status VARCHAR(32) NOT NULL,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT platform_banners_status_check CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CLOSED')),
    CONSTRAINT platform_banners_action_check CHECK (
        (action_type = 'NONE' AND action_target IS NULL)
        OR (action_type IN ('OPEN_BROWSER', 'OPEN_APP_PAGE') AND action_target IS NOT NULL AND btrim(action_target) <> '')
    ),
    CONSTRAINT platform_banners_schedule_check CHECK (
        (status = 'SCHEDULED' AND scheduled_at IS NOT NULL)
        OR (status <> 'SCHEDULED' AND scheduled_at IS NULL)
    ),
    CONSTRAINT platform_banners_published_timestamp_check CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
    CONSTRAINT platform_banners_expiry_check CHECK (
        expires_at IS NULL
        OR (status = 'SCHEDULED' AND expires_at > scheduled_at)
        OR (status = 'PUBLISHED' AND expires_at > published_at)
        OR status IN ('DRAFT', 'CLOSED')
    )
);

CREATE INDEX platform_banners_parent_feed_idx
    ON platform_banners (published_at DESC, created_at DESC)
    WHERE status = 'PUBLISHED';

CREATE INDEX platform_banners_scheduled_idx
    ON platform_banners (scheduled_at)
    WHERE status = 'SCHEDULED';

ALTER TABLE tenant_announcements
    ADD COLUMN image_url VARCHAR(2048),
    ADD COLUMN action_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
    ADD COLUMN action_target VARCHAR(2048),
    ADD CONSTRAINT tenant_announcements_action_check CHECK (
        (action_type = 'NONE' AND action_target IS NULL)
        OR (action_type IN ('OPEN_BROWSER', 'OPEN_APP_PAGE') AND action_target IS NOT NULL AND btrim(action_target) <> '')
    );
