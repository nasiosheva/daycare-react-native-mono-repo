-- Mories Deo Hutapea,S.E.,S.Kom
-- The adjustment ledger records approved findings only. It does not execute
-- refunds, credits, offsets, or subscription coverage changes.
CREATE TABLE tenant_payment_correction_requests (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    payment_id UUID NOT NULL REFERENCES tenant_payments(id),
    requested_by_user_id UUID NOT NULL REFERENCES users(id),
    category VARCHAR(40) NOT NULL CHECK (category IN ('AMOUNT_MISMATCH', 'WRONG_REFERENCE', 'WRONG_PROOF_OR_INVOICE', 'DUPLICATE_OR_OVERPAYMENT')),
    description VARCHAR(1000) NOT NULL,
    proposed_amount NUMERIC(14, 0),
    proposed_reference VARCHAR(200),
    request_idempotency_key UUID NOT NULL,
    request_payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES users(id),
    review_reason VARCHAR(1000),
    review_idempotency_key UUID,
    review_payload_hash VARCHAR(64),
    CONSTRAINT tenant_payment_correction_request_key_unique UNIQUE (organization_id, requested_by_user_id, request_idempotency_key),
    CONSTRAINT tenant_payment_correction_review_key_unique UNIQUE (reviewed_by_user_id, review_idempotency_key)
);

CREATE UNIQUE INDEX tenant_payment_correction_one_pending_idx
    ON tenant_payment_correction_requests (organization_id, payment_id)
    WHERE status = 'PENDING';

CREATE INDEX tenant_payment_correction_queue_idx
    ON tenant_payment_correction_requests (status, created_at ASC);

CREATE TABLE tenant_payment_adjustments (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    payment_id UUID NOT NULL REFERENCES tenant_payments(id),
    correction_request_id UUID NOT NULL REFERENCES tenant_payment_correction_requests(id),
    approved_by_user_id UUID NOT NULL REFERENCES users(id),
    kind VARCHAR(30) NOT NULL CHECK (kind IN ('UNDERPAYMENT', 'EXCESS_CREDIT', 'REVIEWED_NO_AMOUNT_CHANGE')),
    amount NUMERIC(14, 0) NOT NULL CHECK (amount >= 0),
    reason VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT tenant_payment_adjustment_request_unique UNIQUE (correction_request_id)
);

CREATE INDEX tenant_payment_adjustments_payment_idx
    ON tenant_payment_adjustments (organization_id, payment_id, created_at DESC);
