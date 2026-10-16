-- Mories Deo Hutapea,S.E.,S.Kom
-- Decision idempotency is scoped by tenant, actor, operation, and key.
ALTER TABLE tenant_payments
    ADD COLUMN decision_operation VARCHAR(20);

UPDATE tenant_payments
SET decision_operation = CASE status
    WHEN 'PAID' THEN 'MARK_PAID'
    WHEN 'VOID' THEN 'VOID'
    ELSE NULL
END
WHERE decision_idempotency_key IS NOT NULL;

ALTER TABLE tenant_payments
    DROP CONSTRAINT tenant_payment_decision_key_unique;

ALTER TABLE tenant_payments
    ADD CONSTRAINT tenant_payment_decision_scope_key_unique
        UNIQUE (organization_id, decision_by_user_id, decision_operation, decision_idempotency_key);
