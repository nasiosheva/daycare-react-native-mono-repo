-- Mories Deo Hutapea,S.E.,S.Kom
-- Platform Admin's mark-paid/void decision on a tenant payment was the only
-- tenant-subscription financial command without an Idempotency-Key contract.
-- These columns mirror the review_idempotency_key/review_payload_hash pattern
-- already used by tenant_payment_proofs and tenant_payment_correction_requests.
ALTER TABLE tenant_payments
    ADD COLUMN decision_by_user_id UUID REFERENCES users(id),
    ADD COLUMN decision_idempotency_key UUID,
    ADD COLUMN decision_payload_hash VARCHAR(64);

ALTER TABLE tenant_payments
    ADD CONSTRAINT tenant_payment_decision_key_unique UNIQUE (decision_by_user_id, decision_idempotency_key);
