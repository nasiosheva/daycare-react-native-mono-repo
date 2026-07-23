ALTER TABLE curriculum_programs
    ALTER COLUMN organization_id DROP NOT NULL;

CREATE INDEX curriculum_programs_global_idx
    ON curriculum_programs (name)
    WHERE organization_id IS NULL;
