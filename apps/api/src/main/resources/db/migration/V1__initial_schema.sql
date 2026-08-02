-- ===================================================================
-- Originally: V1__initial_schema.sql
-- ===================================================================
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
  active BOOLEAN NOT NULL DEFAULT TRUE,
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
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  active BOOLEAN NOT NULL DEFAULT TRUE
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

CREATE TABLE classroom_programs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT classroom_programs_unique UNIQUE (classroom_id, name)
);
CREATE INDEX classroom_programs_classroom_idx ON classroom_programs (organization_id, classroom_id, created_at DESC);

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

-- ===================================================================
-- Originally: V2__payment_proofs.sql
-- ===================================================================
CREATE TABLE payment_proofs (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id),
  status VARCHAR(20) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  image_data BYTEA NOT NULL,
  note VARCHAR(500),
  submitted_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id),
  rejection_reason VARCHAR(500)
);

-- ===================================================================
-- Originally: V3__curriculum_activities_and_child_nisn.sql
-- ===================================================================
CREATE TABLE curriculum_activities (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT curriculum_activities_unique UNIQUE (organization_id, name)
);
CREATE INDEX curriculum_activities_organization_idx ON curriculum_activities (organization_id, created_at DESC);

CREATE TABLE curriculum_activity_assessments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  activity_id UUID NOT NULL REFERENCES curriculum_activities(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT curriculum_activity_assessments_unique UNIQUE (activity_id, name)
);
CREATE INDEX curriculum_activity_assessments_activity_idx ON curriculum_activity_assessments (organization_id, activity_id, created_at DESC);

ALTER TABLE children ADD COLUMN nisn VARCHAR(20);

-- ===================================================================
-- Originally: V4__parent_registration_role.sql
-- ===================================================================
ALTER TABLE users ADD COLUMN registration_role VARCHAR(20);

UPDATE users
SET registration_role = 'PARENT'
WHERE EXISTS (
    SELECT 1
    FROM memberships
    WHERE memberships.user_id = users.id
      AND memberships.role = 'PARENT'
);

ALTER TABLE users
    ADD CONSTRAINT users_registration_role_parent_check
    CHECK (registration_role IS NULL OR registration_role = 'PARENT');

-- ===================================================================
-- Originally: V5__global_curriculum_programs.sql
-- ===================================================================
ALTER TABLE curriculum_programs
    ALTER COLUMN organization_id DROP NOT NULL;

CREATE INDEX curriculum_programs_global_idx
    ON curriculum_programs (name)
    WHERE organization_id IS NULL;

-- ===================================================================
-- Originally: V6__staff_child_program_permission.sql
-- ===================================================================
ALTER TABLE memberships
    ADD COLUMN can_manage_child_programs BOOLEAN NOT NULL DEFAULT FALSE;

-- ===================================================================
-- Originally: V7__child_gender.sql
-- ===================================================================
ALTER TABLE children ADD COLUMN gender VARCHAR(16) NOT NULL DEFAULT 'UNSPECIFIED';

-- ===================================================================
-- Originally: V8__child_goals.sql
-- ===================================================================
CREATE TABLE goal_templates (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  learning_level_id UUID REFERENCES learning_levels(id),
  classroom_id UUID REFERENCES classrooms(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  duration_days INTEGER NOT NULL,
  minimum_yes_percent INTEGER NOT NULL,
  minimum_yes_streak INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT goal_templates_scope CHECK (learning_level_id IS NOT NULL OR classroom_id IS NOT NULL),
  CONSTRAINT goal_templates_duration_positive CHECK (duration_days > 0),
  CONSTRAINT goal_templates_percent_range CHECK (minimum_yes_percent BETWEEN 0 AND 100),
  CONSTRAINT goal_templates_streak_positive CHECK (minimum_yes_streak >= 0)
);
CREATE INDEX goal_templates_organization_idx ON goal_templates (organization_id, active, created_at DESC);

CREATE TABLE child_goals (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id),
  template_id UUID NOT NULL REFERENCES goal_templates(id),
  starts_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  final_outcome VARCHAR(20),
  final_summary VARCHAR(2000),
  finalized_by_user_id UUID REFERENCES users(id),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX child_goals_active_template_idx ON child_goals (child_id, template_id) WHERE status = 'ACTIVE';
CREATE INDEX child_goals_child_idx ON child_goals (organization_id, child_id, created_at DESC);

CREATE TABLE child_goal_check_ins (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_goal_id UUID NOT NULL REFERENCES child_goals(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  outcome VARCHAR(10) NOT NULL,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_goal_check_ins_unique UNIQUE (child_goal_id, check_in_date)
);
CREATE INDEX child_goal_check_ins_goal_idx ON child_goal_check_ins (child_goal_id, check_in_date);

-- ===================================================================
-- Originally: V9__goal_indicators.sql
-- ===================================================================
CREATE TABLE goal_template_indicators (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  goal_template_id UUID NOT NULL REFERENCES goal_templates(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX goal_template_indicators_template_idx ON goal_template_indicators (goal_template_id, display_order);

-- Every existing goal template becomes its own single indicator, named after the goal, so historical check-ins keep their meaning.
INSERT INTO goal_template_indicators (id, organization_id, goal_template_id, name, display_order, active, created_at)
SELECT gen_random_uuid(), organization_id, id, name, 0, active, created_at FROM goal_templates;

ALTER TABLE child_goal_check_ins ADD COLUMN indicator_id UUID REFERENCES goal_template_indicators(id);

UPDATE child_goal_check_ins cci
SET indicator_id = gti.id
FROM child_goals cg
JOIN goal_template_indicators gti ON gti.goal_template_id = cg.template_id
WHERE cci.child_goal_id = cg.id;

ALTER TABLE child_goal_check_ins ALTER COLUMN indicator_id SET NOT NULL;
ALTER TABLE child_goal_check_ins DROP CONSTRAINT child_goal_check_ins_unique;
ALTER TABLE child_goal_check_ins ADD CONSTRAINT child_goal_check_ins_unique UNIQUE (child_goal_id, indicator_id, check_in_date);
CREATE INDEX child_goal_check_ins_indicator_idx ON child_goal_check_ins (indicator_id, check_in_date);

-- ===================================================================
-- Originally: V10__staff_reminders.sql
-- ===================================================================
ALTER TABLE device_tokens ADD COLUMN installation_id VARCHAR(128);
ALTER TABLE device_tokens ADD COLUMN time_zone VARCHAR(64);
CREATE UNIQUE INDEX device_tokens_installation_id_unique ON device_tokens (installation_id) WHERE installation_id IS NOT NULL;

CREATE TABLE staff_reminders (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  hour INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  weekdays VARCHAR(32) NOT NULL,
  target_code VARCHAR(32) NOT NULL,
  action_path VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  rule_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT staff_reminders_hour_range CHECK (hour BETWEEN 0 AND 23),
  CONSTRAINT staff_reminders_minute_range CHECK (minute BETWEEN 0 AND 59)
);
CREATE INDEX staff_reminders_owner_idx ON staff_reminders (organization_id, user_id, created_at DESC);
CREATE INDEX staff_reminders_active_idx ON staff_reminders (active);

CREATE TABLE staff_reminder_device_schedules (
  id UUID PRIMARY KEY,
  reminder_id UUID NOT NULL REFERENCES staff_reminders(id) ON DELETE CASCADE,
  installation_id VARCHAR(128) NOT NULL,
  rule_version INTEGER NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT staff_reminder_device_schedules_unique UNIQUE (reminder_id, installation_id)
);

-- ===================================================================
-- Originally: V11__development_category_configuration.sql
-- ===================================================================
ALTER TABLE memberships ADD COLUMN can_manage_development_categories BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE development_entries ALTER COLUMN category TYPE VARCHAR(64);

CREATE TABLE development_categories (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX development_categories_organization_name_idx ON development_categories (organization_id, lower(name));

-- ===================================================================
-- Originally: V12__device_push_notification_preferences.sql
-- ===================================================================
ALTER TABLE device_tokens ADD COLUMN push_muted_until TIMESTAMPTZ;

-- ===================================================================
-- Originally: V13__primary_staff_administrators.sql
-- ===================================================================
ALTER TABLE memberships ADD COLUMN primary_staff_admin BOOLEAN NOT NULL DEFAULT FALSE;

WITH ranked_staff_administrators AS (
    SELECT memberships.id,
           ROW_NUMBER() OVER (PARTITION BY memberships.organization_id ORDER BY users.created_at ASC, memberships.id ASC) AS position
    FROM memberships
    JOIN users ON users.id = memberships.user_id
    WHERE memberships.role = 'STAFF_ADMIN'
)
UPDATE memberships
SET primary_staff_admin = TRUE
FROM ranked_staff_administrators
WHERE memberships.id = ranked_staff_administrators.id
  AND ranked_staff_administrators.position = 1;

CREATE UNIQUE INDEX memberships_primary_staff_admin_organization_unique
    ON memberships (organization_id)
    WHERE primary_staff_admin = TRUE;

-- ===================================================================
-- Originally: V14__institution_type_catalog.sql
-- ===================================================================
CREATE TABLE institution_type_definitions (
  code VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX institution_type_definitions_name_unique
  ON institution_type_definitions (LOWER(name));

INSERT INTO institution_type_definitions (code, name, active) VALUES
  ('DAYCARE', 'Daycare', TRUE),
  ('PAUD', 'PAUD', TRUE),
  ('TK', 'Taman kanak-kanak', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ===================================================================
-- Originally: V15__user_gender_and_date_of_birth.sql
-- ===================================================================
ALTER TABLE users ADD COLUMN gender VARCHAR(16) NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE users ADD COLUMN date_of_birth DATE;

-- ===================================================================
-- Originally: V16__parent_enrollment_approval_before_payment.sql
-- ===================================================================
ALTER TABLE parent_enrollments
    ALTER COLUMN invoice_id DROP NOT NULL,
    ALTER COLUMN entitlement_id DROP NOT NULL,
    ADD COLUMN selected_plan_id UUID,
    ADD COLUMN selected_plan_name VARCHAR(200),
    ADD COLUMN selected_plan_type VARCHAR(20),
    ADD COLUMN selected_subtotal_amount NUMERIC(14,2),
    ADD COLUMN selected_discount_amount NUMERIC(14,2),
    ADD COLUMN selected_discount_name VARCHAR(200),
    ADD COLUMN selected_discount_code VARCHAR(80),
    ADD COLUMN selected_total_amount NUMERIC(14,2),
    ADD COLUMN selected_credit_count INTEGER,
    ADD COLUMN selected_unused_credit_policy VARCHAR(20),
    ADD COLUMN selected_carry_forward_days INTEGER,
    ADD COLUMN selected_booking_requires_approval BOOLEAN;

UPDATE parent_enrollments enrollment
SET selected_plan_id = entitlement.plan_id,
    selected_plan_name = entitlement.plan_name,
    selected_plan_type = entitlement.plan_type,
    selected_subtotal_amount = invoice.subtotal_amount,
    selected_discount_amount = invoice.discount_amount,
    selected_discount_name = invoice.discount_name,
    selected_discount_code = invoice.discount_code,
    selected_total_amount = invoice.total_amount,
    selected_credit_count = entitlement.total_credits,
    selected_booking_requires_approval = entitlement.booking_requires_approval
FROM invoices invoice
JOIN service_entitlements entitlement ON entitlement.invoice_id = invoice.id
WHERE enrollment.invoice_id = invoice.id;

ALTER TABLE parent_enrollments
    ALTER COLUMN selected_plan_id SET NOT NULL,
    ALTER COLUMN selected_plan_name SET NOT NULL,
    ALTER COLUMN selected_plan_type SET NOT NULL,
    ALTER COLUMN selected_subtotal_amount SET NOT NULL,
    ALTER COLUMN selected_discount_amount SET NOT NULL,
    ALTER COLUMN selected_total_amount SET NOT NULL,
    ALTER COLUMN selected_booking_requires_approval SET NOT NULL;

UPDATE parent_enrollments
SET status = 'PENDING_APPROVAL'
WHERE status = 'PENDING_PAYMENT';

CREATE TABLE tenant_payment_instructions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    account_holder VARCHAR(200) NOT NULL,
    account_number VARCHAR(200) NOT NULL,
    note VARCHAR(500),
    active BOOLEAN NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX tenant_payment_instructions_organization_idx ON tenant_payment_instructions(organization_id, active, display_order);

-- ===================================================================
-- Originally: V17__global_development_categories.sql
-- ===================================================================
ALTER TABLE development_categories ALTER COLUMN organization_id DROP NOT NULL;

DROP INDEX development_categories_organization_name_idx;
CREATE UNIQUE INDEX development_categories_organization_name_idx ON development_categories (organization_id, lower(name));
CREATE UNIQUE INDEX development_categories_global_name_idx ON development_categories (lower(name)) WHERE organization_id IS NULL;

DO $$
DECLARE
  seed_user_id UUID;
  activity_id UUID := gen_random_uuid();
  meal_id UUID := gen_random_uuid();
  nap_id UUID := gen_random_uuid();
  observation_id UUID := gen_random_uuid();
BEGIN
  SELECT user_id INTO seed_user_id FROM platform_administrators LIMIT 1;
  IF seed_user_id IS NULL THEN
    SELECT id INTO seed_user_id FROM users ORDER BY id LIMIT 1;
  END IF;

  IF seed_user_id IS NOT NULL THEN
    INSERT INTO development_categories (id, organization_id, name, active, created_by_user_id, created_at) VALUES
      (activity_id, NULL, 'Aktivitas', TRUE, seed_user_id, now()),
      (meal_id, NULL, 'Makan', TRUE, seed_user_id, now()),
      (nap_id, NULL, 'Tidur', TRUE, seed_user_id, now()),
      (observation_id, NULL, 'Observasi', TRUE, seed_user_id, now());

    UPDATE development_entries SET category = activity_id::text WHERE category = 'ACTIVITY';
    UPDATE development_entries SET category = meal_id::text WHERE category = 'MEAL';
    UPDATE development_entries SET category = nap_id::text WHERE category = 'NAP';
    UPDATE development_entries SET category = observation_id::text WHERE category = 'OBSERVATION';
  END IF;
END $$;

-- ===================================================================
-- Originally: V18__branch_operating_hours_and_overtime.sql
-- ===================================================================
ALTER TABLE invoices ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'SERVICE';
ALTER TABLE invoices ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE invoices ADD COLUMN child_id UUID REFERENCES children(id);
ALTER TABLE invoices ADD COLUMN description VARCHAR(500);
CREATE INDEX invoices_branch_idx ON invoices (organization_id, branch_id, created_at DESC);

CREATE TABLE branch_operating_hours (
  id UUID PRIMARY KEY, branch_id UUID NOT NULL REFERENCES branches(id), day_of_week VARCHAR(16) NOT NULL,
  active BOOLEAN NOT NULL, opens_at TIME, closes_at TIME, UNIQUE(branch_id, day_of_week)
);
CREATE TABLE branch_overtime_rate_tiers (
  id UUID PRIMARY KEY, branch_id UUID NOT NULL REFERENCES branches(id), display_order INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL, amount NUMERIC(14,2) NOT NULL, UNIQUE(branch_id, display_order)
);
CREATE TABLE overtime_charges (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id), payer_user_id UUID NOT NULL REFERENCES users(id), invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id),
  operational_date DATE NOT NULL, picked_up_at TIME NOT NULL, closes_at TIME NOT NULL, overtime_minutes INTEGER NOT NULL, total_amount NUMERIC(14,2) NOT NULL
);
CREATE TABLE overtime_charge_tier_snapshots (
  id UUID PRIMARY KEY, overtime_charge_id UUID NOT NULL REFERENCES overtime_charges(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL, duration_minutes INTEGER NOT NULL, amount NUMERIC(14,2) NOT NULL
);

-- ===================================================================
-- Originally: V19__global_goal_templates.sql
-- ===================================================================
-- Goal templates can now be global (organization_id NULL), mirroring curriculum_programs, so a
-- single platform-wide reference set is visible to every tenant in every environment, including
-- production, without per-tenant duplication.
ALTER TABLE goal_templates ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE goal_template_indicators ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE goal_templates DROP CONSTRAINT goal_templates_scope;
ALTER TABLE goal_templates ADD CONSTRAINT goal_templates_scope
    CHECK (organization_id IS NULL OR learning_level_id IS NOT NULL OR classroom_id IS NOT NULL);

ALTER TABLE goal_templates ADD COLUMN min_age_months INTEGER;
ALTER TABLE goal_templates ADD COLUMN max_age_months INTEGER;
ALTER TABLE goal_templates ADD COLUMN category VARCHAR(32);

CREATE INDEX goal_templates_global_idx ON goal_templates (name) WHERE organization_id IS NULL;

-- 138 age-graded reference Goal templates for children 1-5 years old, grouped by developmental
-- category (135 from the age-banded curriculum plus 3 general milestones -  home address,
-- sustained focus, and enjoying shared reading - that had no age-graded equivalent). Every row
-- here is global (organization_id/learning_level_id/classroom_id all NULL) so it is visible to
-- every tenant. duration_days/minimum_yes_percent/minimum_yes_streak follow a fixed default per
-- category: KEMANDIRIAN 21/80/7, BAHASA_KOMUNIKASI 21/70/5, KOGNITIF 30/70/3, MOTORIK_HALUS
-- 30/70/3, MOTORIK_KASAR 21/70/3, SOSIAL_EMOSI 21/70/5.
INSERT INTO goal_templates (id, organization_id, learning_level_id, classroom_id, name, description, duration_days, minimum_yes_percent, minimum_yes_streak, min_age_months, max_age_months, category, active, created_at) VALUES
-- 1-2 tahun (12-24 bulan) - Kemandirian
(gen_random_uuid(), NULL, NULL, NULL, 'Makan sendiri menggunakan sendok', 'Anak mampu makan menggunakan sendok sendiri.', 21, 80, 7, 12, 24, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Minum dari gelas', 'Anak mampu minum dari gelas sendiri.', 21, 80, 7, 12, 24, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mencuci tangan dengan bantuan', 'Anak mampu mencuci tangan dengan bantuan orang dewasa.', 21, 80, 7, 12, 24, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Melepas sepatu/sandal', 'Anak mampu melepas sepatu atau sandal sendiri.', 21, 80, 7, 12, 24, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Merapikan mainan setelah bermain', 'Anak mampu merapikan mainan setelah selesai bermain.', 21, 80, 7, 12, 24, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Tidur siang sesuai jadwal', 'Anak mengikuti jadwal tidur siang yang ditetapkan.', 21, 80, 7, 12, 24, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mulai mengenal toilet (toilet readiness)', 'Anak mulai menunjukkan tanda kesiapan menggunakan toilet.', 21, 80, 7, 12, 24, 'KEMANDIRIAN', true, now()),
-- 1-2 tahun - Bahasa & Komunikasi
(gen_random_uuid(), NULL, NULL, NULL, 'Menyebut nama sendiri', 'Anak mampu menyebutkan namanya sendiri.', 21, 70, 5, 12, 24, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menyebut nama ayah dan ibu', 'Anak mampu menyebutkan nama ayah dan ibunya.', 21, 70, 5, 12, 24, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menambah kosakata baru', 'Anak menunjukkan penambahan kosakata baru.', 21, 70, 5, 12, 24, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menirukan kata dan kalimat sederhana', 'Anak mampu menirukan kata dan kalimat sederhana.', 21, 70, 5, 12, 24, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mendengarkan cerita pendek', 'Anak mampu mendengarkan cerita pendek dengan fokus.', 21, 70, 5, 12, 24, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bernyanyi lagu anak', 'Anak mampu ikut bernyanyi lagu anak-anak sederhana.', 21, 70, 5, 12, 24, 'BAHASA_KOMUNIKASI', true, now()),
-- 1-2 tahun - Kognitif
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali warna dasar', 'Anak mampu mengenali warna-warna dasar.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali bentuk dasar', 'Anak mampu mengenali bentuk-bentuk dasar.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali anggota tubuh', 'Anak mampu menunjuk atau menyebutkan anggota tubuhnya.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali hewan dan suaranya', 'Anak mampu mengenali hewan beserta suaranya.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali buah dan sayur', 'Anak mampu mengenali jenis buah dan sayur.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali kendaraan', 'Anak mampu mengenali jenis-jenis kendaraan.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Memasangkan benda yang sama', 'Anak mampu memasangkan dua benda yang sama.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menyusun balok sederhana', 'Anak mampu menyusun balok sederhana.', 30, 70, 3, 12, 24, 'KOGNITIF', true, now()),
-- 1-2 tahun - Motorik Halus
(gen_random_uuid(), NULL, NULL, NULL, 'Mencoret dengan krayon', 'Anak mampu mencoret bebas menggunakan krayon.', 30, 70, 3, 12, 24, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Finger painting', 'Anak mampu melakukan aktivitas finger painting.', 30, 70, 3, 12, 24, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menempel stiker', 'Anak mampu menempelkan stiker sesuai arahan.', 30, 70, 3, 12, 24, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Memindahkan benda menggunakan sendok', 'Anak mampu memindahkan benda kecil menggunakan sendok.', 30, 70, 3, 12, 24, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Memasukkan balok sesuai bentuk', 'Anak mampu memasukkan balok ke lubang sesuai bentuknya.', 30, 70, 3, 12, 24, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Puzzle 2-4 keping', 'Anak mampu menyusun puzzle sederhana 2 hingga 4 keping.', 30, 70, 3, 12, 24, 'MOTORIK_HALUS', true, now()),
-- 1-2 tahun - Motorik Kasar
(gen_random_uuid(), NULL, NULL, NULL, 'Berjalan di garis', 'Anak mampu berjalan mengikuti garis lurus.', 21, 70, 3, 12, 24, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Berlari', 'Anak mampu berlari dengan koordinasi yang baik.', 21, 70, 3, 12, 24, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Melompat kecil', 'Anak mampu melompat kecil di tempat.', 21, 70, 3, 12, 24, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menendang bola', 'Anak mampu menendang bola ke arah tertentu.', 21, 70, 3, 12, 24, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Melempar bola besar', 'Anak mampu melempar bola besar dengan dua tangan.', 21, 70, 3, 12, 24, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain rintangan sederhana', 'Anak mampu melewati rintangan bermain yang sederhana.', 21, 70, 3, 12, 24, 'MOTORIK_KASAR', true, now()),
-- 1-2 tahun - Sosial & Emosi
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain bersama teman', 'Anak mampu bermain berdampingan dengan teman.', 21, 70, 5, 12, 24, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Belajar berbagi', 'Anak menunjukkan kemauan berbagi dengan teman.', 21, 70, 5, 12, 24, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Belajar antre', 'Anak mampu menunggu giliran/antre sederhana.', 21, 70, 5, 12, 24, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali emosi dasar (1-2 tahun)', 'Anak mampu menunjukkan atau menyebutkan emosi dasar.', 21, 70, 5, 12, 24, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengucapkan tolong dan terima kasih', 'Anak mampu mengucapkan tolong dan terima kasih pada situasi yang tepat.', 21, 70, 5, 12, 24, 'SOSIAL_EMOSI', true, now()),

-- 2-3 tahun (24-36 bulan) - Kemandirian
(gen_random_uuid(), NULL, NULL, NULL, 'Toilet training', 'Anak menjalani proses toilet training secara aktif.', 21, 80, 7, 24, 36, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Makan dengan rapi', 'Anak mampu makan sendiri dengan rapi, tidak banyak berantakan.', 21, 80, 7, 24, 36, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Minum tanpa tumpah', 'Anak mampu minum dari gelas tanpa menumpahkan isinya.', 21, 80, 7, 24, 36, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Cuci tangan mandiri', 'Anak mampu mencuci tangan sendiri tanpa bantuan.', 21, 80, 7, 24, 36, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Melepas dan memakai sandal', 'Anak mampu melepas dan memakai sandal sendiri.', 21, 80, 7, 24, 36, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Merapikan mainan (2-3 tahun)', 'Anak mampu merapikan mainan sendiri setelah bermain.', 21, 80, 7, 24, 36, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Membuka tas dan botol minum sendiri', 'Anak mampu membuka tas dan botol minumnya sendiri.', 21, 80, 7, 24, 36, 'KEMANDIRIAN', true, now()),
-- 2-3 tahun - Bahasa & Komunikasi
(gen_random_uuid(), NULL, NULL, NULL, 'Berbicara menggunakan kalimat sederhana', 'Anak mampu berbicara menggunakan kalimat sederhana.', 21, 70, 5, 24, 36, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menjawab pertanyaan sederhana', 'Anak mampu menjawab pertanyaan sederhana yang diajukan.', 21, 70, 5, 24, 36, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menghafal lagu anak (2-3 tahun)', 'Anak mampu menghafal lagu anak-anak sederhana.', 21, 70, 5, 24, 36, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menceritakan pengalaman singkat', 'Anak mampu menceritakan pengalamannya secara singkat.', 21, 70, 5, 24, 36, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengikuti instruksi 2 langkah', 'Anak mampu mengikuti instruksi yang terdiri dari 2 langkah.', 21, 70, 5, 24, 36, 'BAHASA_KOMUNIKASI', true, now()),
-- 2-3 tahun - Kognitif
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali warna (2-3 tahun)', 'Anak mampu mengenali dan menyebutkan warna.', 30, 70, 3, 24, 36, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali bentuk (2-3 tahun)', 'Anak mampu mengenali dan menyebutkan bentuk.', 30, 70, 3, 24, 36, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menghitung 1-10', 'Anak mampu menghitung angka 1 sampai 10.', 30, 70, 3, 24, 36, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali huruf A-Z (2-3 tahun)', 'Anak mampu mengenali huruf A sampai Z.', 30, 70, 3, 24, 36, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali ukuran besar-kecil', 'Anak mampu membedakan ukuran besar dan kecil.', 30, 70, 3, 24, 36, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengelompokkan benda berdasarkan warna atau bentuk', 'Anak mampu mengelompokkan benda berdasarkan warna atau bentuk.', 30, 70, 3, 24, 36, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Puzzle 6-8 keping', 'Anak mampu menyusun puzzle 6 hingga 8 keping.', 30, 70, 3, 24, 36, 'KOGNITIF', true, now()),
-- 2-3 tahun - Motorik Halus
(gen_random_uuid(), NULL, NULL, NULL, 'Mewarnai dalam area', 'Anak mampu mewarnai di dalam area gambar.', 30, 70, 3, 24, 36, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menggunting garis lurus', 'Anak mampu menggunting mengikuti garis lurus.', 30, 70, 3, 24, 36, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Membuat kolase sederhana', 'Anak mampu membuat kolase sederhana.', 30, 70, 3, 24, 36, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain playdough', 'Anak mampu membentuk playdough sederhana.', 30, 70, 3, 24, 36, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Meronce ukuran besar', 'Anak mampu meronce manik-manik berukuran besar.', 30, 70, 3, 24, 36, 'MOTORIK_HALUS', true, now()),
-- 2-3 tahun - Motorik Kasar
(gen_random_uuid(), NULL, NULL, NULL, 'Melompat dengan dua kaki', 'Anak mampu melompat menggunakan kedua kaki.', 21, 70, 3, 24, 36, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Berdiri satu kaki beberapa detik', 'Anak mampu berdiri dengan satu kaki selama beberapa detik.', 21, 70, 3, 24, 36, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Berlari menghindari rintangan', 'Anak mampu berlari sambil menghindari rintangan.', 21, 70, 3, 24, 36, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menangkap bola besar', 'Anak mampu menangkap bola besar.', 21, 70, 3, 24, 36, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menari mengikuti musik', 'Anak mampu menari mengikuti irama musik.', 21, 70, 3, 24, 36, 'MOTORIK_KASAR', true, now()),
-- 2-3 tahun - Sosial & Emosi
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain peran sederhana', 'Anak mampu bermain peran sederhana.', 21, 70, 5, 24, 36, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengucapkan maaf', 'Anak mampu mengucapkan maaf pada situasi yang tepat.', 21, 70, 5, 24, 36, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengungkapkan perasaan', 'Anak mampu mengungkapkan perasaannya.', 21, 70, 5, 24, 36, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menunggu giliran', 'Anak mampu menunggu giliran saat bermain.', 21, 70, 5, 24, 36, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain kelompok kecil', 'Anak mampu bermain dalam kelompok kecil.', 21, 70, 5, 24, 36, 'SOSIAL_EMOSI', true, now()),

-- 3-4 tahun (36-48 bulan) - Kemandirian
(gen_random_uuid(), NULL, NULL, NULL, 'Toilet mandiri', 'Anak mampu menggunakan toilet secara mandiri.', 21, 80, 7, 36, 48, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Memakai pakaian sederhana sendiri', 'Anak mampu memakai pakaian sederhana sendiri.', 21, 80, 7, 36, 48, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menggosok gigi dengan pengawasan', 'Anak mampu menggosok gigi dengan pengawasan orang dewasa.', 21, 80, 7, 36, 48, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menyiapkan perlengkapan makan', 'Anak mampu menyiapkan perlengkapan makannya sendiri.', 21, 80, 7, 36, 48, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Membereskan perlengkapan sendiri', 'Anak mampu membereskan perlengkapannya sendiri.', 21, 80, 7, 36, 48, 'KEMANDIRIAN', true, now()),
-- 3-4 tahun - Bahasa & Komunikasi
(gen_random_uuid(), NULL, NULL, NULL, 'Berbicara dengan kalimat lengkap', 'Anak mampu berbicara menggunakan kalimat lengkap.', 21, 70, 5, 36, 48, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bercerita dari gambar', 'Anak mampu bercerita berdasarkan gambar.', 21, 70, 5, 36, 48, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menghafal doa pendek', 'Anak mampu menghafal doa pendek sesuai keyakinan keluarga.', 21, 70, 5, 36, 48, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenal lawan kata sederhana', 'Anak mampu mengenal lawan kata sederhana.', 21, 70, 5, 36, 48, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengikuti instruksi 3 langkah', 'Anak mampu mengikuti instruksi yang terdiri dari 3 langkah.', 21, 70, 5, 36, 48, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menghafal alamat rumah', 'Anak mampu menyebutkan alamat rumah atau minimal nama area tempat tinggalnya.', 21, 70, 5, 36, 48, 'BAHASA_KOMUNIKASI', true, now()),
-- 3-4 tahun - Kognitif
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali angka 1-20', 'Anak mampu mengenali angka 1 sampai 20.', 30, 70, 3, 36, 48, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali huruf besar dan kecil', 'Anak mampu mengenali huruf besar dan huruf kecil.', 30, 70, 3, 36, 48, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menulis nama depan', 'Anak mampu menulis nama depannya sendiri.', 30, 70, 3, 36, 48, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menghitung benda', 'Anak mampu menghitung jumlah benda.', 30, 70, 3, 36, 48, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali pola sederhana', 'Anak mampu mengenali pola sederhana.', 30, 70, 3, 36, 48, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali konsep waktu (pagi, siang, malam)', 'Anak mampu mengenali konsep pagi, siang, dan malam.', 30, 70, 3, 36, 48, 'KOGNITIF', true, now()),
-- 3-4 tahun - Motorik Halus
(gen_random_uuid(), NULL, NULL, NULL, 'Menggambar bentuk dasar', 'Anak mampu menggambar bentuk dasar.', 30, 70, 3, 36, 48, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menggunting mengikuti pola', 'Anak mampu menggunting mengikuti pola.', 30, 70, 3, 36, 48, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menulis garis dan lengkung', 'Anak mampu menulis garis dan lengkung.', 30, 70, 3, 36, 48, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Meronce (3-4 tahun)', 'Anak mampu meronce manik-manik.', 30, 70, 3, 36, 48, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Puzzle 12 keping', 'Anak mampu menyusun puzzle 12 keping.', 30, 70, 3, 36, 48, 'MOTORIK_HALUS', true, now()),
-- 3-4 tahun - Motorik Kasar
(gen_random_uuid(), NULL, NULL, NULL, 'Melompat jauh', 'Anak mampu melompat jauh.', 21, 70, 3, 36, 48, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Berjalan di papan keseimbangan', 'Anak mampu berjalan di atas papan keseimbangan.', 21, 70, 3, 36, 48, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Melempar dan menangkap bola', 'Anak mampu melempar dan menangkap bola.', 21, 70, 3, 36, 48, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain estafet sederhana', 'Anak mampu mengikuti permainan estafet sederhana.', 21, 70, 3, 36, 48, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Senam irama', 'Anak mampu mengikuti senam irama.', 21, 70, 3, 36, 48, 'MOTORIK_KASAR', true, now()),
-- 3-4 tahun - Sosial & Emosi
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain kelompok', 'Anak mampu bermain dalam kelompok.', 21, 70, 5, 36, 48, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menyelesaikan konflik sederhana', 'Anak mampu menyelesaikan konflik sederhana dengan bantuan.', 21, 70, 5, 36, 48, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali aturan permainan', 'Anak mampu mengenali dan mengikuti aturan permainan.', 21, 70, 5, 36, 48, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menunjukkan empati', 'Anak mampu menunjukkan sikap empati kepada teman.', 21, 70, 5, 36, 48, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bertanggung jawab terhadap barang pribadi', 'Anak mampu bertanggung jawab menjaga barang pribadinya.', 21, 70, 5, 36, 48, 'SOSIAL_EMOSI', true, now()),

-- 4-5 tahun (48-60 bulan) - Kemandirian
(gen_random_uuid(), NULL, NULL, NULL, 'Mandiri ke toilet', 'Anak mampu ke toilet secara mandiri sepenuhnya.', 21, 80, 7, 48, 60, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Memakai baju dan sepatu sendiri', 'Anak mampu memakai baju dan sepatu sendiri.', 21, 80, 7, 48, 60, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengancingkan baju dan membuka resleting', 'Anak mampu mengancingkan baju dan membuka resleting sendiri.', 21, 80, 7, 48, 60, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menyiapkan tas sendiri', 'Anak mampu menyiapkan tasnya sendiri.', 21, 80, 7, 48, 60, 'KEMANDIRIAN', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menjaga kebersihan diri', 'Anak mampu menjaga kebersihan dirinya sendiri.', 21, 80, 7, 48, 60, 'KEMANDIRIAN', true, now()),
-- 4-5 tahun - Bahasa & Komunikasi
(gen_random_uuid(), NULL, NULL, NULL, 'Menceritakan pengalaman dengan runtut', 'Anak mampu menceritakan pengalamannya secara runtut.', 21, 70, 5, 48, 60, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menjawab pertanyaan mengapa', 'Anak mampu menjawab pertanyaan yang diawali kata mengapa.', 21, 70, 5, 48, 60, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali huruf dan bunyi huruf', 'Anak mampu mengenali huruf beserta bunyinya.', 21, 70, 5, 48, 60, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali kata sederhana', 'Anak mampu mengenali kata-kata sederhana.', 21, 70, 5, 48, 60, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Berani berbicara di depan teman', 'Anak berani berbicara di depan teman-temannya.', 21, 70, 5, 48, 60, 'BAHASA_KOMUNIKASI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menyukai kegiatan membaca buku bersama', 'Anak menunjukkan ketertarikan dan antusiasme pada kegiatan membaca buku bersama setiap hari.', 21, 70, 5, 48, 60, 'BAHASA_KOMUNIKASI', true, now()),
-- 4-5 tahun - Kognitif
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali angka 1-50', 'Anak mampu mengenali angka 1 sampai 50.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Berhitung sederhana', 'Anak mampu melakukan hitungan sederhana.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali pola lebih kompleks', 'Anak mampu mengenali pola yang lebih kompleks.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali konsep kanan-kiri', 'Anak mampu mengenali konsep kanan dan kiri.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali hari dalam seminggu', 'Anak mampu menyebutkan hari-hari dalam seminggu.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengenali jam secara sederhana', 'Anak mampu mengenali jam secara sederhana.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menulis nama lengkap', 'Anak mampu menulis nama lengkapnya sendiri.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Duduk fokus 10-20 menit untuk belajar atau membaca', 'Anak mampu duduk fokus mengikuti kegiatan belajar atau membaca selama 10-20 menit.', 30, 70, 3, 48, 60, 'KOGNITIF', true, now()),
-- 4-5 tahun - Motorik Halus
(gen_random_uuid(), NULL, NULL, NULL, 'Menulis huruf dan angka', 'Anak mampu menulis huruf dan angka.', 30, 70, 3, 48, 60, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menggambar orang sederhana', 'Anak mampu menggambar bentuk orang secara sederhana.', 30, 70, 3, 48, 60, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menggunting bentuk', 'Anak mampu menggunting mengikuti bentuk tertentu.', 30, 70, 3, 48, 60, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Melipat kertas', 'Anak mampu melipat kertas sederhana.', 30, 70, 3, 48, 60, 'MOTORIK_HALUS', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Membuat kerajinan sederhana', 'Anak mampu membuat kerajinan tangan sederhana.', 30, 70, 3, 48, 60, 'MOTORIK_HALUS', true, now()),
-- 4-5 tahun - Motorik Kasar
(gen_random_uuid(), NULL, NULL, NULL, 'Melompat dengan satu kaki', 'Anak mampu melompat menggunakan satu kaki.', 21, 70, 3, 48, 60, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Berlari zig-zag', 'Anak mampu berlari mengikuti pola zig-zag.', 21, 70, 3, 48, 60, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bermain bola sederhana', 'Anak mampu bermain bola secara sederhana.', 21, 70, 3, 48, 60, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Senam (4-5 tahun)', 'Anak mampu mengikuti gerakan senam.', 21, 70, 3, 48, 60, 'MOTORIK_KASAR', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Permainan keseimbangan', 'Anak mampu mengikuti permainan keseimbangan.', 21, 70, 3, 48, 60, 'MOTORIK_KASAR', true, now()),
-- 4-5 tahun - Sosial & Emosi
(gen_random_uuid(), NULL, NULL, NULL, 'Memimpin permainan sederhana', 'Anak mampu memimpin permainan sederhana.', 21, 70, 5, 48, 60, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menghargai pendapat teman', 'Anak mampu menghargai pendapat temannya.', 21, 70, 5, 48, 60, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Bekerja sama dalam kelompok', 'Anak mampu bekerja sama dalam kelompok.', 21, 70, 5, 48, 60, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Menyelesaikan tugas sampai selesai', 'Anak mampu menyelesaikan tugas hingga selesai.', 21, 70, 5, 48, 60, 'SOSIAL_EMOSI', true, now()),
(gen_random_uuid(), NULL, NULL, NULL, 'Mengendalikan emosi dengan arahan', 'Anak mampu mengendalikan emosinya dengan arahan orang dewasa.', 21, 70, 5, 48, 60, 'SOSIAL_EMOSI', true, now());

-- Every seeded global template gets exactly one indicator named after the template, mirroring the
-- V9 backfill and GoalService.createTemplate's behavior for templates made through the API.
INSERT INTO goal_template_indicators (id, organization_id, goal_template_id, name, display_order, active, created_at)
SELECT gen_random_uuid(), NULL, id, name, 0, true, now()
FROM goal_templates
WHERE organization_id IS NULL;

-- ===================================================================
-- Originally: V20__global_development_category_master_data.sql
-- ===================================================================
ALTER TABLE development_categories ALTER COLUMN created_by_user_id DROP NOT NULL;

INSERT INTO development_categories (id, organization_id, name, active, created_by_user_id, created_at) VALUES
  (gen_random_uuid(), NULL, 'Aktivitas', TRUE, NULL, now()),
  (gen_random_uuid(), NULL, 'Makan', TRUE, NULL, now()),
  (gen_random_uuid(), NULL, 'Tidur', TRUE, NULL, now()),
  (gen_random_uuid(), NULL, 'Observasi', TRUE, NULL, now())
ON CONFLICT (lower(name)) WHERE organization_id IS NULL DO NOTHING;

-- ===================================================================
-- Consolidated baseline: formerly V2__curriculum_program_goal_templates.sql
-- ===================================================================
ALTER TABLE curriculum_programs
    ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE curriculum_programs
SET is_template = organization_id IS NULL;

ALTER TABLE goal_templates
    ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE goal_templates
SET is_template = organization_id IS NULL;

CREATE TABLE curriculum_program_goal_templates (
  id UUID PRIMARY KEY,
  curriculum_program_id UUID NOT NULL REFERENCES curriculum_programs(id) ON DELETE CASCADE,
  goal_template_id UUID NOT NULL REFERENCES goal_templates(id) ON DELETE CASCADE,
  CONSTRAINT curriculum_program_goal_templates_unique UNIQUE (curriculum_program_id, goal_template_id)
);

CREATE INDEX curriculum_program_goal_templates_program_idx
    ON curriculum_program_goal_templates (curriculum_program_id);
CREATE INDEX curriculum_program_goal_templates_goal_idx
    ON curriculum_program_goal_templates (goal_template_id);
CREATE INDEX curriculum_programs_active_idx
    ON curriculum_programs (organization_id, active, name);

-- ===================================================================
-- Consolidated baseline: formerly V3__goal_category_restructure.sql
-- ===================================================================
ALTER TABLE goal_templates RENAME TO goal_categories;
ALTER TABLE goal_categories RENAME COLUMN category TO domain;
ALTER TABLE goal_template_indicators RENAME TO goal_category_items;
ALTER TABLE goal_category_items RENAME COLUMN goal_template_id TO goal_category_id;
ALTER TABLE child_goals RENAME COLUMN template_id TO category_id;
ALTER TABLE curriculum_program_goal_templates RENAME TO curriculum_program_goal_categories;
ALTER TABLE curriculum_program_goal_categories RENAME COLUMN goal_template_id TO goal_category_id;

ALTER INDEX goal_templates_organization_idx RENAME TO goal_categories_organization_idx;
ALTER INDEX goal_template_indicators_template_idx RENAME TO goal_category_items_category_idx;
ALTER INDEX child_goals_active_template_idx RENAME TO child_goals_active_category_idx;
ALTER INDEX curriculum_program_goal_templates_program_idx RENAME TO curriculum_program_goal_categories_program_idx;
ALTER INDEX curriculum_program_goal_templates_goal_idx RENAME TO curriculum_program_goal_categories_goal_idx;
DROP INDEX goal_templates_global_idx;

ALTER TABLE learning_levels ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE learning_levels ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX learning_levels_global_name_idx ON learning_levels (name) WHERE organization_id IS NULL;

INSERT INTO learning_levels (id, organization_id, name, min_age_months, max_age_months, display_order, is_template, active) VALUES
(gen_random_uuid(), NULL, 'Toddler (1-2 Tahun)', 12, 24, 0, true, true),
(gen_random_uuid(), NULL, 'Kelompok Bermain (2-3 Tahun)', 24, 36, 1, true, true),
(gen_random_uuid(), NULL, 'Kelompok A (3-4 Tahun)', 36, 48, 2, true, true),
(gen_random_uuid(), NULL, 'Kelompok B (4-5 Tahun)', 48, 60, 3, true, true);

INSERT INTO goal_categories (id, organization_id, learning_level_id, name, description, duration_days, minimum_yes_percent, minimum_yes_streak, domain, is_template, active, created_at)
SELECT
  gen_random_uuid(),
  NULL,
  level.id,
  CASE agg.domain
    WHEN 'KEMANDIRIAN' THEN 'Kemandirian'
    WHEN 'BAHASA_KOMUNIKASI' THEN 'Bahasa & Komunikasi'
    WHEN 'KOGNITIF' THEN 'Kognitif'
    WHEN 'MOTORIK_HALUS' THEN 'Motorik Halus'
    WHEN 'MOTORIK_KASAR' THEN 'Motorik Kasar'
    WHEN 'SOSIAL_EMOSI' THEN 'Sosial & Emosi'
  END,
  '',
  agg.duration_days, agg.minimum_yes_percent, agg.minimum_yes_streak, agg.domain, true, true, now()
FROM (
  SELECT DISTINCT ON (min_age_months, domain) min_age_months, max_age_months, domain, duration_days, minimum_yes_percent, minimum_yes_streak
  FROM goal_categories
  WHERE organization_id IS NULL
  ORDER BY min_age_months, domain
) agg
JOIN learning_levels level ON level.organization_id IS NULL AND level.is_template AND level.min_age_months = agg.min_age_months AND level.max_age_months = agg.max_age_months;

CREATE TEMP TABLE goal_category_migration_map AS
SELECT old_cat.id AS old_id, new_cat.id AS new_id
FROM goal_categories old_cat
JOIN learning_levels level ON level.organization_id IS NULL AND level.is_template AND level.min_age_months = old_cat.min_age_months AND level.max_age_months = old_cat.max_age_months
JOIN goal_categories new_cat ON new_cat.organization_id IS NULL AND new_cat.learning_level_id = level.id AND new_cat.domain = old_cat.domain AND new_cat.id != old_cat.id
WHERE old_cat.organization_id IS NULL AND old_cat.min_age_months IS NOT NULL;

UPDATE goal_category_items item
SET goal_category_id = map.new_id
FROM goal_category_migration_map map
WHERE item.goal_category_id = map.old_id;

DELETE FROM goal_categories WHERE id IN (SELECT old_id FROM goal_category_migration_map);
DROP TABLE goal_category_migration_map;

UPDATE goal_categories gc
SET learning_level_id = c.learning_level_id
FROM classrooms c
WHERE gc.classroom_id = c.id AND gc.learning_level_id IS NULL AND c.learning_level_id IS NOT NULL;

UPDATE goal_categories SET domain = 'KEMANDIRIAN' WHERE domain IS NULL;

ALTER TABLE goal_categories DROP CONSTRAINT goal_templates_scope;
ALTER TABLE goal_categories ALTER COLUMN learning_level_id SET NOT NULL;
ALTER TABLE goal_categories ALTER COLUMN domain SET NOT NULL;
ALTER TABLE goal_categories DROP COLUMN classroom_id;
ALTER TABLE goal_categories DROP COLUMN min_age_months;
ALTER TABLE goal_categories DROP COLUMN max_age_months;
CREATE UNIQUE INDEX goal_categories_tenant_scope_idx ON goal_categories (organization_id, learning_level_id, domain) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX goal_categories_global_scope_idx ON goal_categories (learning_level_id, domain) WHERE organization_id IS NULL;

-- ===================================================================
-- Consolidated baseline: formerly V4__remove_global_curriculum_seed_from_schema_path.sql
-- ===================================================================
DELETE FROM goal_category_items
WHERE goal_category_id IN (
  SELECT gc.id FROM goal_categories gc
  JOIN learning_levels ll ON ll.id = gc.learning_level_id
  WHERE gc.organization_id IS NULL AND gc.is_template = true
    AND ll.organization_id IS NULL AND ll.is_template = true
    AND ll.name IN ('Toddler (1-2 Tahun)', 'Kelompok Bermain (2-3 Tahun)', 'Kelompok A (3-4 Tahun)', 'Kelompok B (4-5 Tahun)')
);

DELETE FROM goal_categories gc
USING learning_levels ll
WHERE gc.learning_level_id = ll.id AND gc.organization_id IS NULL AND gc.is_template = true
  AND ll.organization_id IS NULL AND ll.is_template = true
  AND ll.name IN ('Toddler (1-2 Tahun)', 'Kelompok Bermain (2-3 Tahun)', 'Kelompok A (3-4 Tahun)', 'Kelompok B (4-5 Tahun)');

DELETE FROM learning_levels
WHERE organization_id IS NULL AND is_template = true
  AND name IN ('Toddler (1-2 Tahun)', 'Kelompok Bermain (2-3 Tahun)', 'Kelompok A (3-4 Tahun)', 'Kelompok B (4-5 Tahun)');

-- ===================================================================
-- Consolidated baseline: formerly V5__rename_goal_category_to_development_program.sql
-- ===================================================================
ALTER TABLE goal_categories RENAME TO development_programs;
ALTER TABLE goal_category_items RENAME TO development_program_items;
ALTER TABLE development_program_items RENAME COLUMN goal_category_id TO development_program_id;
ALTER TABLE child_goals RENAME COLUMN category_id TO program_id;
ALTER TABLE curriculum_program_goal_categories RENAME TO curriculum_program_development_programs;
ALTER TABLE curriculum_program_development_programs RENAME COLUMN goal_category_id TO development_program_id;

ALTER INDEX goal_categories_global_scope_idx RENAME TO development_programs_global_scope_idx;
ALTER INDEX goal_categories_tenant_scope_idx RENAME TO development_programs_tenant_scope_idx;
ALTER INDEX goal_categories_organization_idx RENAME TO development_programs_organization_idx;
ALTER INDEX goal_category_items_category_idx RENAME TO development_program_items_program_idx;
ALTER INDEX child_goals_active_category_idx RENAME TO child_goals_active_program_idx;

ALTER TABLE child_goal_check_ins
  ADD COLUMN note VARCHAR(500),
  ADD COLUMN photo_content_type VARCHAR(50),
  ADD COLUMN photo_data BYTEA,
  ADD COLUMN audio_content_type VARCHAR(50),
  ADD COLUMN audio_data BYTEA,
  ADD COLUMN audio_duration_ms INTEGER;

-- ===================================================================
-- Consolidated baseline: formerly V6-V12
-- ===================================================================
ALTER TABLE development_entries
    ADD COLUMN photo_content_type VARCHAR(50),
    ADD COLUMN photo_data BYTEA;

CREATE TABLE revoked_access_tokens (
  id UUID PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX revoked_access_tokens_expires_at_idx ON revoked_access_tokens (expires_at);

ALTER TABLE child_goals
    ADD COLUMN curriculum_program_id UUID REFERENCES curriculum_programs(id);
CREATE INDEX child_goals_curriculum_program_idx ON child_goals (curriculum_program_id);

CREATE TABLE child_absence_requests (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  requester_user_id UUID NOT NULL REFERENCES users(id),
  purpose VARCHAR(32) NOT NULL,
  note VARCHAR(500),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL,
  decided_by_user_id UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  rejection_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_absence_requests_dates CHECK (end_date >= start_date)
);
CREATE INDEX child_absence_requests_child_idx ON child_absence_requests (organization_id, child_id, created_at DESC);
CREATE INDEX child_absence_requests_pending_idx ON child_absence_requests (organization_id, branch_id, status, start_date ASC);

CREATE TABLE staff_leave_requests (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  requester_user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(16) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  status VARCHAR(16) NOT NULL,
  evidence_content_type VARCHAR(50),
  evidence_data BYTEA,
  reviewed_by_user_id UUID REFERENCES users(id),
  rejection_reason VARCHAR(2000),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT staff_leave_requests_date_range CHECK (ends_on >= starts_on)
);
CREATE INDEX staff_leave_requests_requester_idx ON staff_leave_requests (organization_id, requester_user_id, created_at DESC);
CREATE INDEX staff_leave_requests_pending_idx ON staff_leave_requests (organization_id, status, created_at ASC);

CREATE TABLE parent_family_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  husband_date_of_birth DATE,
  husband_occupation VARCHAR(32),
  husband_income_range VARCHAR(32),
  wife_date_of_birth DATE,
  wife_occupation VARCHAR(32),
  wife_income_range VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE institution_type_definitions
  ADD COLUMN IF NOT EXISTS parent_occupation_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_income_range_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- ===================================================================
-- Consolidated baseline: formerly V2__global_program_revisions_and_platform_knowledge.sql
-- ===================================================================
ALTER TABLE development_programs
  ADD COLUMN revised_from_program_id UUID REFERENCES development_programs(id),
  ADD COLUMN revision_number INTEGER NOT NULL DEFAULT 1;
CREATE INDEX development_programs_revision_source_idx ON development_programs (revised_from_program_id);

CREATE TABLE platform_knowledge_candidates (
  id UUID PRIMARY KEY,
  normalized_key VARCHAR(512) NOT NULL UNIQUE,
  topic_name VARCHAR(120) NOT NULL,
  learning_level_name VARCHAR(120) NOT NULL,
  min_age_months INTEGER,
  max_age_months INTEGER,
  domain VARCHAR(40) NOT NULL,
  duration_days INTEGER NOT NULL,
  indicator_names TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  supporting_tenant_count INTEGER NOT NULL,
  relevant_tenant_count INTEGER NOT NULL,
  support_percent INTEGER NOT NULL,
  minimum_tenant_threshold INTEGER NOT NULL,
  minimum_support_percent INTEGER NOT NULL,
  algorithm_version VARCHAR(40) NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id),
  review_reason VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX platform_knowledge_candidates_status_idx ON platform_knowledge_candidates (status, updated_at DESC);

-- ===================================================================
-- Consolidated baseline: formerly V3__private_tutoring.sql
-- ===================================================================
CREATE TABLE private_tutoring_services (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  min_age_months INTEGER NOT NULL,
  max_age_months INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT private_tutoring_services_age_range CHECK (min_age_months >= 0 AND min_age_months <= max_age_months),
  CONSTRAINT private_tutoring_services_duration CHECK (duration_minutes BETWEEN 15 AND 480),
  CONSTRAINT private_tutoring_services_price CHECK (price > 0)
);
CREATE INDEX private_tutoring_services_catalog_idx ON private_tutoring_services (organization_id, branch_id, active);

CREATE TABLE private_tutoring_service_learning_levels (
  id UUID PRIMARY KEY,
  private_tutoring_service_id UUID NOT NULL REFERENCES private_tutoring_services(id) ON DELETE CASCADE,
  learning_level_id UUID NOT NULL REFERENCES learning_levels(id),
  UNIQUE (private_tutoring_service_id, learning_level_id)
);

CREATE TABLE private_tutors (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  type VARCHAR(20) NOT NULL,
  staff_user_id UUID REFERENCES users(id),
  display_name VARCHAR(200) NOT NULL,
  bio VARCHAR(2000) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT private_tutors_type CHECK ((type = 'STAFF' AND staff_user_id IS NOT NULL) OR (type = 'EXTERNAL' AND staff_user_id IS NULL))
);
CREATE UNIQUE INDEX private_tutors_staff_unique ON private_tutors (organization_id, staff_user_id) WHERE staff_user_id IS NOT NULL;

CREATE TABLE private_tutoring_service_tutors (
  id UUID PRIMARY KEY,
  private_tutoring_service_id UUID NOT NULL REFERENCES private_tutoring_services(id) ON DELETE CASCADE,
  private_tutor_id UUID NOT NULL REFERENCES private_tutors(id),
  UNIQUE (private_tutoring_service_id, private_tutor_id)
);

CREATE TABLE private_tutoring_requests (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  parent_user_id UUID NOT NULL REFERENCES users(id),
  child_id UUID NOT NULL REFERENCES children(id),
  private_tutoring_service_id UUID NOT NULL REFERENCES private_tutoring_services(id),
  private_tutor_id UUID REFERENCES private_tutors(id),
  service_name VARCHAR(120) NOT NULL,
  provider_name VARCHAR(200),
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  preferred_at TIMESTAMP,
  scheduled_at TIMESTAMP,
  parent_note VARCHAR(500),
  decision_reason VARCHAR(500),
  status VARCHAR(24) NOT NULL,
  invoice_id UUID UNIQUE REFERENCES invoices(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX private_tutoring_requests_parent_idx ON private_tutoring_requests (organization_id, parent_user_id, created_at DESC);
CREATE INDEX private_tutoring_requests_review_idx ON private_tutoring_requests (organization_id, status, created_at ASC);
CREATE INDEX private_tutoring_requests_tutor_schedule_idx ON private_tutoring_requests (private_tutor_id, scheduled_at);

-- ===================================================================
-- Consolidated baseline: formerly V4-V12
-- ===================================================================
ALTER TABLE branches ADD COLUMN full_address VARCHAR(2000);
ALTER TABLE branches ADD COLUMN google_maps_url VARCHAR(2048);

ALTER TABLE development_program_items ADD COLUMN priority BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE child_health_records (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL UNIQUE REFERENCES children(id) ON DELETE CASCADE,
  blood_type VARCHAR(10),
  allergies VARCHAR(2000),
  medical_conditions VARCHAR(2000),
  medications VARCHAR(2000),
  emergency_instructions VARCHAR(2000),
  updated_by_user_id UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE child_incident_reports (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  reported_by_user_id UUID NOT NULL REFERENCES users(id),
  severity VARCHAR(20) NOT NULL,
  category VARCHAR(20) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  action_taken VARCHAR(2000),
  occurred_at TIMESTAMPTZ NOT NULL,
  photo_content_type VARCHAR(50),
  photo_data BYTEA,
  acknowledged_by_user_id UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_incident_reports_child_idx ON child_incident_reports (child_id, occurred_at DESC);

ALTER TABLE memberships ADD COLUMN deactivated_at TIMESTAMPTZ;

CREATE TABLE development_entry_media (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  development_entry_id UUID NOT NULL REFERENCES development_entries(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  data BYTEA NOT NULL,
  duration_ms INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX development_entry_media_entry_idx ON development_entry_media (development_entry_id, display_order);

CREATE TABLE child_incident_acknowledgements (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES child_incident_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ NOT NULL,
  UNIQUE (incident_id, user_id)
);

INSERT INTO child_incident_acknowledgements (id, incident_id, user_id, acknowledged_at)
SELECT gen_random_uuid(), id, acknowledged_by_user_id, acknowledged_at
FROM child_incident_reports
WHERE acknowledged_by_user_id IS NOT NULL AND acknowledged_at IS NOT NULL;

ALTER TABLE child_programs
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN parent_visible BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN parent_summary VARCHAR(2000),
    ADD COLUMN home_guidance VARCHAR(2000),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE child_program_steps (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_program_id UUID NOT NULL REFERENCES child_programs(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  home_guidance VARCHAR(2000),
  parent_visible BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_steps_program_idx ON child_program_steps (organization_id, child_program_id, display_order, created_at);

CREATE TABLE child_program_staff_notes (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_program_id UUID NOT NULL REFERENCES child_programs(id) ON DELETE CASCADE,
  child_program_step_id UUID REFERENCES child_program_steps(id) ON DELETE SET NULL,
  author_user_id UUID NOT NULL REFERENCES users(id),
  note VARCHAR(2000) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_staff_notes_program_idx ON child_program_staff_notes (organization_id, child_program_id, recorded_at DESC);

CREATE TABLE child_program_parent_feedback (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_program_id UUID NOT NULL REFERENCES child_programs(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES users(id),
  note VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_parent_feedback_program_idx ON child_program_parent_feedback (organization_id, child_program_id, created_at DESC);

CREATE TABLE child_goal_conclusion_corrections (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    child_goal_id UUID NOT NULL REFERENCES child_goals(id) ON DELETE CASCADE,
    previous_outcome VARCHAR(20) NOT NULL,
    previous_summary VARCHAR(2000) NOT NULL,
    corrected_outcome VARCHAR(20) NOT NULL,
    corrected_summary VARCHAR(2000) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    corrected_by_user_id UUID NOT NULL REFERENCES users(id),
    corrected_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX child_goal_conclusion_corrections_goal_idx
    ON child_goal_conclusion_corrections (organization_id, child_goal_id, corrected_at);

-- ===================================================================
-- Consolidated baseline: formerly V13__private_tutoring_pricing_type.sql
-- ===================================================================
ALTER TABLE private_tutoring_services
  ADD COLUMN daily_price NUMERIC(14,2),
  ADD COLUMN weekly_price NUMERIC(14,2),
  ADD COLUMN monthly_price NUMERIC(14,2);

UPDATE private_tutoring_services SET daily_price = price;

ALTER TABLE private_tutoring_services DROP CONSTRAINT private_tutoring_services_price;
ALTER TABLE private_tutoring_services DROP COLUMN price;

ALTER TABLE private_tutoring_services
  ADD CONSTRAINT private_tutoring_services_prices_positive CHECK (
    (daily_price IS NULL OR daily_price > 0)
    AND (weekly_price IS NULL OR weekly_price > 0)
    AND (monthly_price IS NULL OR monthly_price > 0)
  ),
  ADD CONSTRAINT private_tutoring_services_has_price CHECK (
    daily_price IS NOT NULL OR weekly_price IS NOT NULL OR monthly_price IS NOT NULL
  );

ALTER TABLE private_tutoring_requests
  ADD COLUMN pricing_type VARCHAR(16) NOT NULL DEFAULT 'DAILY';

ALTER TABLE private_tutoring_requests
  ADD CONSTRAINT private_tutoring_requests_pricing_type CHECK (pricing_type IN ('DAILY', 'WEEKLY', 'MONTHLY'));

-- ===================================================================
-- Consolidated baseline: formerly V14-V19
-- ===================================================================
CREATE TABLE education_offerings (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  institution_type VARCHAR(80) NOT NULL,
  enrollment_mode VARCHAR(40) NOT NULL,
  capabilities VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(40) NOT NULL,
  program_code VARCHAR(80) NOT NULL DEFAULT 'DEFAULT',
  revision BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, branch_id, institution_type, enrollment_mode, program_code)
);

CREATE INDEX education_offerings_scope_idx ON education_offerings (organization_id, branch_id, status);

INSERT INTO education_offerings (id, organization_id, branch_id, institution_type, enrollment_mode, capabilities, status, program_code, revision, created_at, updated_at)
SELECT gen_random_uuid(), assignment.organization_id, branch.id, assignment.type_code,
  CASE WHEN assignment.type_code = 'DAYCARE' THEN 'DAYCARE_SERVICE' ELSE 'SCHOOL_ADMISSION' END,
  CASE WHEN assignment.type_code = 'DAYCARE' THEN 'DAYCARE_OPERATIONS'
       WHEN assignment.type_code IN ('PAUD', 'TK') THEN 'ACADEMIC_CURRICULUM'
       ELSE '' END,
  'PUBLISHED', 'DEFAULT', 1, NOW(), NOW()
FROM organization_types assignment
JOIN branches branch ON branch.organization_id = assignment.organization_id AND branch.active = TRUE;

INSERT INTO institution_type_definitions (code, name, active) VALUES
  ('TPA', 'Taman Penitipan Anak', TRUE),
  ('KB', 'Kelompok Bermain', TRUE),
  ('SPS', 'Satuan PAUD Sejenis', TRUE),
  ('RA', 'Raudhatul Athfal', TRUE),
  ('BIMBA', 'BIMBA', TRUE),
  ('SD', 'Sekolah Dasar', TRUE),
  ('MI', 'Madrasah Ibtidaiyah', TRUE),
  ('SMP', 'Sekolah Menengah Pertama', TRUE),
  ('MTS', 'Madrasah Tsanawiyah', TRUE),
  ('SMA', 'Sekolah Menengah Atas', TRUE),
  ('MA', 'Madrasah Aliyah', TRUE),
  ('SMK', 'Sekolah Menengah Kejuruan', TRUE)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE institution_type_definitions
  ADD COLUMN IF NOT EXISTS logo VARCHAR(500),
  ADD COLUMN IF NOT EXISTS background_color VARCHAR(32),
  ADD COLUMN IF NOT EXISTS border_color VARCHAR(32),
  ADD COLUMN IF NOT EXISTS text_color VARCHAR(32),
  ADD COLUMN IF NOT EXISTS parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description VARCHAR(2000);

UPDATE institution_type_definitions
SET description = CASE code
  WHEN 'DAYCARE' THEN 'Layanan penitipan anak dengan operasional harian, paket layanan, booking, dan kehadiran.'
  WHEN 'TPA' THEN 'Layanan penitipan anak untuk perawatan, pengasuhan, dan kegiatan sesuai usia.'
  WHEN 'KB' THEN 'Satuan pendidikan anak usia dini untuk kelompok bermain.'
  WHEN 'SPS' THEN 'Layanan PAUD berbasis masyarakat dengan bentuk penyelenggaraan yang beragam.'
  WHEN 'PAUD' THEN 'Pendidikan anak usia dini untuk stimulasi tumbuh kembang sebelum pendidikan dasar.'
  WHEN 'TK' THEN 'Pendidikan anak usia dini dalam bentuk taman kanak-kanak.'
  WHEN 'RA' THEN 'Pendidikan anak usia dini berciri keagamaan Islam setara taman kanak-kanak.'
  WHEN 'BIMBA' THEN 'Program bimbingan minat baca dan belajar awal untuk anak usia dini.'
  WHEN 'SD' THEN 'Pendidikan dasar jenjang sekolah dasar.'
  WHEN 'MI' THEN 'Pendidikan dasar berciri keagamaan Islam setara sekolah dasar.'
  WHEN 'SMP' THEN 'Pendidikan dasar jenjang sekolah menengah pertama.'
  WHEN 'MTS' THEN 'Pendidikan dasar berciri keagamaan Islam setara sekolah menengah pertama.'
  WHEN 'SMA' THEN 'Pendidikan menengah umum jenjang sekolah menengah atas.'
  WHEN 'MA' THEN 'Pendidikan menengah berciri keagamaan Islam setara sekolah menengah atas.'
  WHEN 'SMK' THEN 'Pendidikan menengah kejuruan dengan program keahlian.'
END
WHERE code IN ('DAYCARE', 'TPA', 'KB', 'SPS', 'PAUD', 'TK', 'RA', 'BIMBA', 'SD', 'MI', 'SMP', 'MTS', 'SMA', 'MA', 'SMK')
  AND (description IS NULL OR BTRIM(description) = '');
