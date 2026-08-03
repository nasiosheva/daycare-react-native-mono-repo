CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id),
  name VARCHAR(160) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX emergency_contacts_child_idx ON emergency_contacts (organization_id, child_id, created_at DESC);
