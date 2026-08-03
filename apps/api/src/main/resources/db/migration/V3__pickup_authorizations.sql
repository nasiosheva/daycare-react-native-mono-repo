CREATE TABLE pickup_authorizations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  pickup_person_name VARCHAR(160) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  verification_method VARCHAR(40) NOT NULL,
  status VARCHAR(40) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  verified_by_user_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT pickup_authorizations_effective_dates CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE INDEX pickup_authorizations_child_idx ON pickup_authorizations (organization_id, child_id, created_at DESC);
ALTER TABLE attendance_records ADD COLUMN pickup_authorization_id UUID REFERENCES pickup_authorizations(id);
ALTER TABLE attendance_records ADD COLUMN pickup_person_name VARCHAR(160);
ALTER TABLE attendance_records ADD COLUMN pickup_verification_method VARCHAR(40);
ALTER TABLE attendance_records ADD COLUMN checkout_verified_by_user_id UUID REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN checkout_exception_reason VARCHAR(500);
