CREATE TABLE tenant_feedback (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    submitted_by_user_id UUID NOT NULL REFERENCES users(id),
    category VARCHAR(20) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX tenant_feedback_org_idx ON tenant_feedback (organization_id, status, created_at DESC);
CREATE INDEX tenant_feedback_submitter_idx ON tenant_feedback (organization_id, submitted_by_user_id, created_at DESC);
