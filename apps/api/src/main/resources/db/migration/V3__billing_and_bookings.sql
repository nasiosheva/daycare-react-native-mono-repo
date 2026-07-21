CREATE TABLE service_plans (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), name VARCHAR(120) NOT NULL, plan_type VARCHAR(20) NOT NULL,
  price NUMERIC(14,2) NOT NULL, credit_count INTEGER, unused_credit_policy VARCHAR(20), carry_forward_days INTEGER,
  booking_requires_approval BOOLEAN NOT NULL, active BOOLEAN NOT NULL
);
CREATE TABLE invoices (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), payer_user_id UUID NOT NULL REFERENCES users(id), invoice_number VARCHAR(80) NOT NULL UNIQUE,
  total_amount NUMERIC(14,2) NOT NULL, status VARCHAR(20) NOT NULL, due_date DATE NOT NULL, created_at TIMESTAMPTZ NOT NULL, paid_at TIMESTAMPTZ
);
CREATE TABLE service_entitlements (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), branch_id UUID NOT NULL REFERENCES branches(id), child_id UUID NOT NULL REFERENCES children(id), owner_user_id UUID NOT NULL REFERENCES users(id), plan_id UUID NOT NULL REFERENCES service_plans(id), invoice_id UUID NOT NULL REFERENCES invoices(id),
  plan_name VARCHAR(120) NOT NULL, plan_type VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL, total_credits INTEGER, used_credits INTEGER NOT NULL, reserved_credits INTEGER NOT NULL, booking_requires_approval BOOLEAN NOT NULL,
  period_start DATE NOT NULL, period_end DATE NOT NULL, valid_until DATE NOT NULL
);
CREATE TABLE bookings (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), branch_id UUID NOT NULL REFERENCES branches(id), child_id UUID NOT NULL REFERENCES children(id), entitlement_id UUID NOT NULL REFERENCES service_entitlements(id), invoice_id UUID NOT NULL REFERENCES invoices(id),
  booking_date DATE NOT NULL, status VARCHAR(24) NOT NULL, plan_name VARCHAR(120) NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX service_plans_organization_idx ON service_plans (organization_id, active);
CREATE INDEX invoices_payer_idx ON invoices (organization_id, payer_user_id, created_at DESC);
CREATE INDEX entitlements_owner_idx ON service_entitlements (organization_id, owner_user_id, valid_until);
CREATE INDEX bookings_approval_idx ON bookings (organization_id, status, booking_date);
