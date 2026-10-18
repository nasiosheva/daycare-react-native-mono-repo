-- Mories Deo Hutapea,S.E.,S.Kom
ALTER TABLE platform_banners
    ADD COLUMN audience_type VARCHAR(32) NOT NULL DEFAULT 'PARENT_GLOBAL',
    ADD COLUMN target_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    ADD CONSTRAINT platform_banners_audience_check CHECK (
        audience_type IN ('PARENT_GLOBAL', 'STAFF_ADMIN_GLOBAL', 'TENANT_STAFF_ADMIN')
    ),
    ADD CONSTRAINT platform_banners_target_organization_check CHECK (
        (audience_type = 'TENANT_STAFF_ADMIN' AND target_organization_id IS NOT NULL)
        OR (audience_type <> 'TENANT_STAFF_ADMIN' AND target_organization_id IS NULL)
    );

CREATE INDEX platform_banners_staff_admin_global_feed_idx
    ON platform_banners (published_at DESC)
    WHERE status = 'PUBLISHED' AND audience_type = 'STAFF_ADMIN_GLOBAL';

CREATE INDEX platform_banners_staff_admin_tenant_feed_idx
    ON platform_banners (target_organization_id, published_at DESC)
    WHERE status = 'PUBLISHED' AND audience_type = 'TENANT_STAFF_ADMIN';
