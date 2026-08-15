CREATE TABLE child_program_templates (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_templates_org_idx ON child_program_templates (organization_id, created_at DESC);

CREATE TABLE child_program_template_steps (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_program_template_id UUID NOT NULL REFERENCES child_program_templates(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  home_guidance VARCHAR(2000),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_template_steps_template_idx ON child_program_template_steps (organization_id, child_program_template_id, display_order, created_at);
