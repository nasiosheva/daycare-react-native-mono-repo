-- Mories Deo Hutapea,S.E.,S.Kom
-- Private evidence remains disabled by default until finance/privacy storage
-- classification and retention are approved.
CREATE TABLE tenant_payment_proofs (
    id UUID PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES tenant_payments(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(64) NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    file_data BYTEA NOT NULL,
    upload_idempotency_key UUID NOT NULL,
    upload_payload_hash VARCHAR(64) NOT NULL,
    review_idempotency_key UUID,
    review_payload_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUBMITTED', 'VERIFIED', 'REJECTED')),
    submitted_at TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES users(id),
    review_reason VARCHAR(1000),
    CONSTRAINT tenant_payment_proof_version_unique UNIQUE (payment_id, version_number),
    CONSTRAINT tenant_payment_proof_upload_key_unique UNIQUE (organization_id, uploaded_by_user_id, upload_idempotency_key),
    CONSTRAINT tenant_payment_proof_review_key_unique UNIQUE (reviewed_by_user_id, review_idempotency_key)
);

CREATE INDEX tenant_payment_proofs_review_queue_idx
    ON tenant_payment_proofs (status, submitted_at ASC);

CREATE INDEX tenant_payment_proofs_org_payment_idx
    ON tenant_payment_proofs (organization_id, payment_id, version_number DESC);
