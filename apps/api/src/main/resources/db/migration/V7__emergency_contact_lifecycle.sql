ALTER TABLE emergency_contacts
  ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN effective_until TIMESTAMPTZ,
  ADD COLUMN revoked_by_user_id UUID REFERENCES users(id),
  ADD COLUMN revoked_at TIMESTAMPTZ,
  ADD COLUMN revocation_reason VARCHAR(500);

ALTER TABLE emergency_contacts
  ADD CONSTRAINT emergency_contacts_status CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED'));
