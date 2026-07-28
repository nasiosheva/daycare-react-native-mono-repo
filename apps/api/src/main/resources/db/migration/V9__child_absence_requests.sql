CREATE TABLE child_absence_requests (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  requester_user_id UUID NOT NULL REFERENCES users(id),
  purpose VARCHAR(32) NOT NULL,
  note VARCHAR(500),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL,
  decided_by_user_id UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  rejection_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_absence_requests_dates CHECK (end_date >= start_date)
);

CREATE INDEX child_absence_requests_child_idx ON child_absence_requests (organization_id, child_id, created_at DESC);
CREATE INDEX child_absence_requests_pending_idx ON child_absence_requests (organization_id, branch_id, status, start_date ASC);
