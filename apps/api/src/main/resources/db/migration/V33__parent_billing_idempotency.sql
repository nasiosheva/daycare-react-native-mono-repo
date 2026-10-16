-- Mories Deo Hutapea,S.E.,S.Kom
CREATE TABLE billing_idempotency_records (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    operation VARCHAR(64) NOT NULL,
    idempotency_key UUID NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT billing_idempotency_scope_key_unique
        UNIQUE (organization_id, actor_user_id, operation, idempotency_key)
);

CREATE INDEX billing_idempotency_created_at_idx
    ON billing_idempotency_records (created_at);
