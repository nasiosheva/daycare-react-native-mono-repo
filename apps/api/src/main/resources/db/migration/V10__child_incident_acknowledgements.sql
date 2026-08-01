CREATE TABLE child_incident_acknowledgements (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES child_incident_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ NOT NULL,
  UNIQUE (incident_id, user_id)
);

INSERT INTO child_incident_acknowledgements (id, incident_id, user_id, acknowledged_at)
SELECT gen_random_uuid(), id, acknowledged_by_user_id, acknowledged_at
FROM child_incident_reports
WHERE acknowledged_by_user_id IS NOT NULL AND acknowledged_at IS NOT NULL;
