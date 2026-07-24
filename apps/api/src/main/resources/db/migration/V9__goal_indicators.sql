CREATE TABLE goal_template_indicators (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  goal_template_id UUID NOT NULL REFERENCES goal_templates(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX goal_template_indicators_template_idx ON goal_template_indicators (goal_template_id, display_order);

-- Every existing goal template becomes its own single indicator, named after the goal, so historical check-ins keep their meaning.
INSERT INTO goal_template_indicators (id, organization_id, goal_template_id, name, display_order, active, created_at)
SELECT gen_random_uuid(), organization_id, id, name, 0, active, created_at FROM goal_templates;

ALTER TABLE child_goal_check_ins ADD COLUMN indicator_id UUID REFERENCES goal_template_indicators(id);

UPDATE child_goal_check_ins cci
SET indicator_id = gti.id
FROM child_goals cg
JOIN goal_template_indicators gti ON gti.goal_template_id = cg.template_id
WHERE cci.child_goal_id = cg.id;

ALTER TABLE child_goal_check_ins ALTER COLUMN indicator_id SET NOT NULL;
ALTER TABLE child_goal_check_ins DROP CONSTRAINT child_goal_check_ins_unique;
ALTER TABLE child_goal_check_ins ADD CONSTRAINT child_goal_check_ins_unique UNIQUE (child_goal_id, indicator_id, check_in_date);
CREATE INDEX child_goal_check_ins_indicator_idx ON child_goal_check_ins (indicator_id, check_in_date);
