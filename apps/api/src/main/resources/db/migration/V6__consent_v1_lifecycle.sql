ALTER TABLE consent_records ADD COLUMN title_snapshot VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE consent_records ADD COLUMN withdrawn_at TIMESTAMPTZ;
ALTER TABLE consent_records DROP CONSTRAINT consent_records_unique_guardian_definition;
ALTER TABLE consent_records ADD CONSTRAINT consent_records_unique_guardian_definition_revision UNIQUE (child_id, definition_id, guardian_user_id, definition_revision);
