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
