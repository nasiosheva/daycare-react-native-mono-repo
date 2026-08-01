ALTER TABLE child_programs
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN parent_visible BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN parent_summary VARCHAR(2000),
    ADD COLUMN home_guidance VARCHAR(2000),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE child_program_steps (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_program_id UUID NOT NULL REFERENCES child_programs(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  home_guidance VARCHAR(2000),
  parent_visible BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_steps_program_idx ON child_program_steps (organization_id, child_program_id, display_order, created_at);

CREATE TABLE child_program_staff_notes (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_program_id UUID NOT NULL REFERENCES child_programs(id) ON DELETE CASCADE,
  child_program_step_id UUID REFERENCES child_program_steps(id) ON DELETE SET NULL,
  author_user_id UUID NOT NULL REFERENCES users(id),
  note VARCHAR(2000) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_staff_notes_program_idx ON child_program_staff_notes (organization_id, child_program_id, recorded_at DESC);

CREATE TABLE child_program_parent_feedback (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_program_id UUID NOT NULL REFERENCES child_programs(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES users(id),
  note VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_program_parent_feedback_program_idx ON child_program_parent_feedback (organization_id, child_program_id, created_at DESC);
