CREATE TABLE child_incident_reports (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  reported_by_user_id UUID NOT NULL REFERENCES users(id),
  severity VARCHAR(20) NOT NULL,
  category VARCHAR(20) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  action_taken VARCHAR(2000),
  occurred_at TIMESTAMPTZ NOT NULL,
  photo_content_type VARCHAR(50),
  photo_data BYTEA,
  acknowledged_by_user_id UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_incident_reports_child_idx ON child_incident_reports (child_id, occurred_at DESC);
