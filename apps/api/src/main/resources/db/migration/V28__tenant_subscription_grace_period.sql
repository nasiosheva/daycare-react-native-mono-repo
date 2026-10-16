-- Mories Deo Hutapea,S.E.,S.Kom
-- Existing tenants receive the approved default. Lifecycle rollout remains a
-- separately reviewed operation; this migration does not change subscription status.
ALTER TABLE tenant_subscriptions
    ADD COLUMN grace_period_days INTEGER NOT NULL DEFAULT 7;

ALTER TABLE tenant_subscriptions
    ADD COLUMN next_grace_period_days INTEGER;

ALTER TABLE tenant_subscriptions
    ADD CONSTRAINT tenant_subscription_next_grace_period_days_check
        CHECK (next_grace_period_days IS NULL OR next_grace_period_days BETWEEN 0 AND 30);

ALTER TABLE tenant_subscriptions
    ADD CONSTRAINT tenant_subscription_grace_period_days_check
        CHECK (grace_period_days BETWEEN 0 AND 30);

ALTER TABLE tenant_subscriptions
    ADD COLUMN next_period_start DATE,
    ADD COLUMN next_period_end DATE,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE tenant_payments
    ADD COLUMN invoice_number VARCHAR(64),
    ADD COLUMN period_start DATE,
    ADD COLUMN period_end DATE,
    ADD COLUMN coverage_period_start DATE,
    ADD COLUMN coverage_period_end DATE,
    ADD COLUMN plan_code_snapshot VARCHAR(20),
    ADD COLUMN idempotency_key UUID,
    ADD COLUMN idempotency_payload_hash VARCHAR(64),
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

UPDATE tenant_payments
SET invoice_number = 'UE-SUB-LEGACY-' || replace(id::text, '-', '')
WHERE invoice_number IS NULL;

ALTER TABLE tenant_payments
    ALTER COLUMN invoice_number SET NOT NULL;

CREATE UNIQUE INDEX tenant_payment_invoice_number_unique ON tenant_payments (invoice_number);

CREATE FUNCTION prevent_tenant_payment_invoice_number_change() RETURNS trigger AS $$
BEGIN
    IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
        RAISE EXCEPTION 'Tenant SaaS invoice numbers are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_payment_invoice_number_immutable
    BEFORE UPDATE OF invoice_number ON tenant_payments
    FOR EACH ROW EXECUTE FUNCTION prevent_tenant_payment_invoice_number_change();

CREATE TABLE tenant_subscription_invoice_sequences (
    invoice_month CHAR(6) PRIMARY KEY,
    last_sequence INTEGER NOT NULL CHECK (last_sequence BETWEEN 1 AND 999999)
);

-- Legacy pending payments represent the subscription's current billed period
-- in the pre-snapshot implementation. Historical paid periods are left null
-- rather than being assigned an unverified date/price snapshot.
UPDATE tenant_payments p
SET period_start = s.period_start,
    period_end = s.period_end,
    plan_code_snapshot = s.plan_code
FROM tenant_subscriptions s
WHERE p.subscription_id = s.id
  AND p.status = 'PENDING'
  AND p.period_start IS NULL;

CREATE UNIQUE INDEX tenant_payment_subscription_period_unique
    ON tenant_payments (subscription_id, period_start, period_end)
    WHERE status <> 'VOID' AND period_start IS NOT NULL AND period_end IS NOT NULL;

CREATE UNIQUE INDEX tenant_payment_organization_idempotency_unique
    ON tenant_payments (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE tenant_subscription_audit_events (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(80) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    before_value TEXT,
    after_value TEXT,
    reference_id UUID,
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX tenant_subscription_audit_org_created_idx
    ON tenant_subscription_audit_events (organization_id, created_at DESC);
