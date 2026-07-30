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
