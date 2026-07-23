CREATE TABLE goal_templates (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  learning_level_id UUID REFERENCES learning_levels(id),
  classroom_id UUID REFERENCES classrooms(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  duration_days INTEGER NOT NULL,
  minimum_yes_percent INTEGER NOT NULL,
  minimum_yes_streak INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT goal_templates_scope CHECK (learning_level_id IS NOT NULL OR classroom_id IS NOT NULL),
  CONSTRAINT goal_templates_duration_positive CHECK (duration_days > 0),
  CONSTRAINT goal_templates_percent_range CHECK (minimum_yes_percent BETWEEN 0 AND 100),
  CONSTRAINT goal_templates_streak_positive CHECK (minimum_yes_streak >= 0)
);
CREATE INDEX goal_templates_organization_idx ON goal_templates (organization_id, active, created_at DESC);

CREATE TABLE child_goals (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id),
  template_id UUID NOT NULL REFERENCES goal_templates(id),
  starts_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  final_outcome VARCHAR(20),
  final_summary VARCHAR(2000),
  finalized_by_user_id UUID REFERENCES users(id),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX child_goals_active_template_idx ON child_goals (child_id, template_id) WHERE status = 'ACTIVE';
CREATE INDEX child_goals_child_idx ON child_goals (organization_id, child_id, created_at DESC);

CREATE TABLE child_goal_check_ins (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_goal_id UUID NOT NULL REFERENCES child_goals(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  outcome VARCHAR(10) NOT NULL,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_goal_check_ins_unique UNIQUE (child_goal_id, check_in_date)
);
CREATE INDEX child_goal_check_ins_goal_idx ON child_goal_check_ins (child_goal_id, check_in_date);
