CREATE TABLE users (
  id UUID PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  username VARCHAR(64),
  email VARCHAR(320),
  local_password_hash VARCHAR(255),
  phone_number VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX users_username_lower_unique ON users (LOWER(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE branches (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(200) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX branches_primary_organization_idx ON branches (organization_id) WHERE is_primary = TRUE;

CREATE TABLE academic_years (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(80) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  active BOOLEAN NOT NULL
);
CREATE INDEX academic_years_organization_idx ON academic_years (organization_id, starts_on DESC);

CREATE TABLE curriculum_programs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  academic_year_id UUID REFERENCES academic_years(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL
);
CREATE INDEX curriculum_programs_organization_idx ON curriculum_programs (organization_id, name);

CREATE TABLE learning_levels (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  min_age_months INTEGER,
  max_age_months INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT learning_levels_age_range CHECK (
    min_age_months IS NULL OR max_age_months IS NULL OR min_age_months <= max_age_months
  ),
  CONSTRAINT learning_levels_organization_name UNIQUE (organization_id, name)
);

CREATE TABLE learning_level_curriculum_programs (
  id UUID PRIMARY KEY,
  learning_level_id UUID NOT NULL REFERENCES learning_levels(id) ON DELETE CASCADE,
  curriculum_program_id UUID NOT NULL REFERENCES curriculum_programs(id) ON DELETE CASCADE,
  CONSTRAINT learning_level_curriculum_programs_unique UNIQUE (learning_level_id, curriculum_program_id)
);

CREATE TABLE classrooms (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name VARCHAR(200) NOT NULL,
  learning_level_id UUID REFERENCES learning_levels(id),
  academic_year_id UUID REFERENCES academic_years(id),
  capacity INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT classrooms_capacity_positive CHECK (capacity IS NULL OR capacity > 0)
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  role VARCHAR(20) NOT NULL,
  branch_id UUID REFERENCES branches(id),
  classroom_id UUID REFERENCES classrooms(id),
  UNIQUE (user_id, organization_id, role, branch_id, classroom_id)
);

CREATE TABLE children (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  classroom_id UUID REFERENCES classrooms(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  date_of_birth DATE NOT NULL,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
CREATE INDEX children_organization_branch_idx ON children (organization_id, branch_id);

CREATE TABLE child_placements (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id),
  learning_level_id UUID REFERENCES learning_levels(id),
  academic_year_id UUID REFERENCES academic_years(id),
  starts_on DATE NOT NULL,
  ended_on DATE,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_placements_dates CHECK (ended_on IS NULL OR ended_on >= starts_on)
);
CREATE UNIQUE INDEX child_placements_active_child_idx ON child_placements (child_id) WHERE ended_on IS NULL;
CREATE INDEX child_placements_classroom_active_idx ON child_placements (classroom_id) WHERE ended_on IS NULL;
CREATE INDEX child_placements_organization_child_idx ON child_placements (organization_id, child_id, starts_on DESC);

CREATE TABLE guardian_links (
  id UUID PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES children(id),
  user_id UUID NOT NULL REFERENCES users(id),
  UNIQUE (child_id, user_id)
);

CREATE TABLE child_programs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_programs_child_idx ON child_programs (organization_id, child_id, created_at DESC);

CREATE TABLE child_staff_assignments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  assignment_role VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_staff_assignments_child_user_unique UNIQUE (child_id, user_id)
);
CREATE INDEX child_staff_assignments_child_idx ON child_staff_assignments (organization_id, child_id, created_at DESC);

CREATE TABLE classroom_staff_assignments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id),
  user_id UUID NOT NULL REFERENCES users(id),
  assignment_role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT classroom_staff_assignments_unique UNIQUE (classroom_id, user_id)
);
CREATE INDEX classroom_staff_assignments_user_idx ON classroom_staff_assignments (organization_id, user_id);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  operational_date DATE NOT NULL,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  check_in_method VARCHAR(20),
  check_out_method VARCHAR(20),
  UNIQUE (child_id, operational_date)
);

CREATE TABLE development_entries (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content VARCHAR(2000) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX development_entries_child_idx ON development_entries (organization_id, child_id, recorded_at DESC);

CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email VARCHAR(320),
  phone_number VARCHAR(32),
  role VARCHAR(20) NOT NULL,
  branch_id UUID REFERENCES branches(id),
  classroom_id UUID REFERENCES classrooms(id),
  status VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (email IS NOT NULL OR phone_number IS NOT NULL)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  recipient_user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  action_path VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_user_id, organization_id, created_at DESC);

CREATE TABLE device_tokens (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  token VARCHAR(512) NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  entity_type VARCHAR(60) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(60) NOT NULL,
  source VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE platform_administrators (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  pin_hash VARCHAR(100),
  pin_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION prevent_platform_administrator_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Platform administrator accounts cannot be deleted';
END;
$$;

CREATE TRIGGER platform_administrators_delete_protected
BEFORE DELETE ON platform_administrators
FOR EACH ROW EXECUTE FUNCTION prevent_platform_administrator_delete();

CREATE TABLE organization_types (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  type_code VARCHAR(20) NOT NULL,
  UNIQUE (organization_id, type_code)
);

CREATE TABLE tenant_subscriptions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id),
  plan_code VARCHAR(20) NOT NULL,
  status VARCHAR(24) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  trial_ends_at DATE,
  monthly_fee NUMERIC(14,2)
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

CREATE TABLE service_plans (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  plan_type VARCHAR(20) NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  credit_count INTEGER,
  unused_credit_policy VARCHAR(20),
  carry_forward_days INTEGER,
  booking_requires_approval BOOLEAN NOT NULL,
  daily_capacity INTEGER,
  active BOOLEAN NOT NULL
);
CREATE INDEX service_plans_organization_idx ON service_plans (organization_id, active);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  payer_user_id UUID NOT NULL REFERENCES users(id),
  invoice_number VARCHAR(80) NOT NULL UNIQUE,
  subtotal_amount NUMERIC(14,2) NOT NULL,
  discount_amount NUMERIC(14,2) NOT NULL,
  discount_name VARCHAR(120),
  discount_code VARCHAR(80),
  total_amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);
CREATE INDEX invoices_payer_idx ON invoices (organization_id, payer_user_id, created_at DESC);

CREATE TABLE service_entitlements (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID NOT NULL REFERENCES service_plans(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  plan_name VARCHAR(120) NOT NULL,
  plan_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  total_credits INTEGER,
  used_credits INTEGER NOT NULL,
  reserved_credits INTEGER NOT NULL,
  booking_requires_approval BOOLEAN NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  valid_until DATE NOT NULL
);
CREATE INDEX entitlements_owner_idx ON service_entitlements (organization_id, owner_user_id, valid_until);

CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  entitlement_id UUID NOT NULL REFERENCES service_entitlements(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  booking_date DATE NOT NULL,
  status VARCHAR(24) NOT NULL,
  plan_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX bookings_approval_idx ON bookings (organization_id, status, booking_date);

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
CREATE INDEX capacity_reservations_branch_date_idx ON capacity_reservations (organization_id, branch_id, capacity_date, status);
CREATE INDEX capacity_reservations_plan_date_idx ON capacity_reservations (organization_id, service_plan_id, capacity_date, status);

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
CREATE INDEX service_plan_discounts_plan_idx ON service_plan_discounts (organization_id, service_plan_id, active);

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
CREATE INDEX service_plan_templates_organization_idx ON service_plan_templates (organization_id, name);

CREATE TABLE parent_enrollments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  entitlement_id UUID NOT NULL REFERENCES service_entitlements(id),
  status VARCHAR(40) NOT NULL,
  rejection_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX parent_enrollments_invoice_unique ON parent_enrollments(invoice_id);
CREATE INDEX parent_enrollments_org_status_idx ON parent_enrollments(organization_id, status, created_at);
CREATE INDEX parent_enrollments_user_idx ON parent_enrollments(user_id, created_at);
