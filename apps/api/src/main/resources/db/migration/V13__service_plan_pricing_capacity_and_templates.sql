ALTER TABLE service_plans ADD COLUMN daily_capacity INTEGER;

ALTER TABLE invoices ADD COLUMN subtotal_amount NUMERIC(14,2);
ALTER TABLE invoices ADD COLUMN discount_amount NUMERIC(14,2);
ALTER TABLE invoices ADD COLUMN discount_name VARCHAR(120);
ALTER TABLE invoices ADD COLUMN discount_code VARCHAR(80);
UPDATE invoices SET subtotal_amount = total_amount, discount_amount = 0 WHERE subtotal_amount IS NULL;
ALTER TABLE invoices ALTER COLUMN subtotal_amount SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN discount_amount SET NOT NULL;

CREATE TABLE branch_capacity_settings (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  daily_capacity INTEGER NOT NULL,
  CONSTRAINT branch_capacity_settings_branch_unique UNIQUE (branch_id)
);

CREATE TABLE capacity_reservations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  service_plan_id UUID NOT NULL REFERENCES service_plans(id),
  entitlement_id UUID NOT NULL REFERENCES service_entitlements(id),
  booking_id UUID REFERENCES bookings(id),
  capacity_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  CONSTRAINT capacity_reservations_entitlement_date_unique UNIQUE (entitlement_id, capacity_date)
);

CREATE TABLE service_plan_discounts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  service_plan_id UUID NOT NULL REFERENCES service_plans(id),
  kind VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  promo_code VARCHAR(80),
  discount_type VARCHAR(20) NOT NULL,
  value NUMERIC(14,2) NOT NULL,
  starts_on DATE,
  ends_on DATE,
  usage_limit INTEGER,
  active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX service_plan_discounts_promo_code_unique ON service_plan_discounts (organization_id, LOWER(promo_code)) WHERE promo_code IS NOT NULL;

CREATE TABLE service_plan_discount_redemptions (
  id UUID PRIMARY KEY,
  discount_id UUID NOT NULL REFERENCES service_plan_discounts(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  CONSTRAINT service_plan_discount_redemptions_invoice_unique UNIQUE (invoice_id)
);

CREATE TABLE service_plan_templates (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  plan_type VARCHAR(20) NOT NULL,
  suggested_price NUMERIC(14,2),
  credit_count INTEGER,
  unused_credit_policy VARCHAR(20),
  carry_forward_days INTEGER,
  booking_requires_approval BOOLEAN NOT NULL,
  daily_capacity INTEGER
);

CREATE INDEX capacity_reservations_branch_date_idx ON capacity_reservations (organization_id, branch_id, capacity_date, status);
CREATE INDEX capacity_reservations_plan_date_idx ON capacity_reservations (organization_id, service_plan_id, capacity_date, status);
CREATE INDEX service_plan_discounts_plan_idx ON service_plan_discounts (organization_id, service_plan_id, active);
CREATE INDEX service_plan_templates_organization_idx ON service_plan_templates (organization_id, name);
