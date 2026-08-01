CREATE TABLE child_goal_conclusion_corrections (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    child_goal_id UUID NOT NULL REFERENCES child_goals(id) ON DELETE CASCADE,
    previous_outcome VARCHAR(20) NOT NULL,
    previous_summary VARCHAR(2000) NOT NULL,
    corrected_outcome VARCHAR(20) NOT NULL,
    corrected_summary VARCHAR(2000) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    corrected_by_user_id UUID NOT NULL REFERENCES users(id),
    corrected_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX child_goal_conclusion_corrections_goal_idx
    ON child_goal_conclusion_corrections (organization_id, child_goal_id, corrected_at);
