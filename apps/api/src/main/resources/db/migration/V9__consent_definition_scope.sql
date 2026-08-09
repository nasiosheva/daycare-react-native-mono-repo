ALTER TABLE consent_definitions
  ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'TENANT',
  ADD COLUMN branch_id UUID REFERENCES branches(id),
  ADD COLUMN offering_id UUID REFERENCES education_offerings(id),
  ADD COLUMN effective_until TIMESTAMPTZ;

ALTER TABLE consent_definitions
  ADD CONSTRAINT consent_definitions_scope CHECK (scope IN ('TENANT', 'BRANCH', 'OFFERING'));
