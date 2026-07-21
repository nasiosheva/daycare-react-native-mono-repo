CREATE TABLE users (
  id UUID PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  email VARCHAR(320),
  phone_number VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE organizations (id UUID PRIMARY KEY, name VARCHAR(200) NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE branches (id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), name VARCHAR(200) NOT NULL, timezone VARCHAR(64) NOT NULL);
CREATE TABLE classrooms (id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), branch_id UUID NOT NULL REFERENCES branches(id), name VARCHAR(200) NOT NULL);
CREATE TABLE memberships (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), organization_id UUID NOT NULL REFERENCES organizations(id), role VARCHAR(20) NOT NULL,
  branch_id UUID REFERENCES branches(id), classroom_id UUID REFERENCES classrooms(id), UNIQUE (user_id, organization_id, role, branch_id, classroom_id)
);
CREATE TABLE children (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), branch_id UUID NOT NULL REFERENCES branches(id), classroom_id UUID REFERENCES classrooms(id),
  first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100), date_of_birth DATE NOT NULL
);
CREATE TABLE guardian_links (id UUID PRIMARY KEY, child_id UUID NOT NULL REFERENCES children(id), user_id UUID NOT NULL REFERENCES users(id), UNIQUE (child_id, user_id));
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), branch_id UUID NOT NULL REFERENCES branches(id), child_id UUID NOT NULL REFERENCES children(id),
  operational_date DATE NOT NULL, checked_in_at TIMESTAMPTZ, checked_out_at TIMESTAMPTZ, check_in_method VARCHAR(20), check_out_method VARCHAR(20), UNIQUE (child_id, operational_date)
);
CREATE TABLE invitations (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), email VARCHAR(320), phone_number VARCHAR(32), role VARCHAR(20) NOT NULL,
  branch_id UUID REFERENCES branches(id), classroom_id UUID REFERENCES classrooms(id), status VARCHAR(20) NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  CHECK (email IS NOT NULL OR phone_number IS NOT NULL)
);
CREATE TABLE notifications (id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), recipient_user_id UUID NOT NULL REFERENCES users(id), title VARCHAR(200) NOT NULL, body VARCHAR(1000) NOT NULL, created_at TIMESTAMPTZ NOT NULL, read_at TIMESTAMPTZ);
CREATE TABLE device_tokens (id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), user_id UUID NOT NULL REFERENCES users(id), token VARCHAR(512) NOT NULL UNIQUE, platform VARCHAR(20) NOT NULL);
CREATE TABLE audit_log (id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id), actor_user_id UUID NOT NULL REFERENCES users(id), entity_type VARCHAR(60) NOT NULL, entity_id UUID NOT NULL, action VARCHAR(60) NOT NULL, source VARCHAR(60) NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE INDEX children_organization_branch_idx ON children (organization_id, branch_id);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_user_id, organization_id, created_at DESC);
