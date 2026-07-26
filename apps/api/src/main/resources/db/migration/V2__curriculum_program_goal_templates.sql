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
