-- Mories Deo Hutapea,S.E.,S.Kom
CREATE TABLE tenant_subscription_reminders (
    id UUID PRIMARY KEY,
    event_key VARCHAR(200) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id),
    payment_id UUID REFERENCES tenant_payments(id),
    event_type VARCHAR(32) NOT NULL,
    event_date DATE NOT NULL,
    lead_days INTEGER NOT NULL CHECK (lead_days IN (1, 3, 7)),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT tenant_subscription_reminder_event_unique UNIQUE (event_key)
);

CREATE INDEX tenant_subscription_reminders_org_created_idx
    ON tenant_subscription_reminders (organization_id, created_at DESC);
