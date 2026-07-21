UPDATE memberships SET role = 'STAFF_ADMIN' WHERE role = 'ADMIN';
UPDATE invitations SET role = 'STAFF_ADMIN' WHERE role = 'ADMIN';

CREATE TABLE platform_administrators (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE tenant_subscriptions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id),
  plan_code VARCHAR(20) NOT NULL,
  status VARCHAR(24) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL
);

CREATE TABLE tenant_payments (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX tenant_payments_organization_idx ON tenant_payments (organization_id, created_at DESC);
