CREATE TABLE staff_leave_requests (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  requester_user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(16) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  status VARCHAR(16) NOT NULL,
  evidence_content_type VARCHAR(50),
  evidence_data BYTEA,
  reviewed_by_user_id UUID REFERENCES users(id),
  rejection_reason VARCHAR(2000),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT staff_leave_requests_date_range CHECK (ends_on >= starts_on)
);

CREATE INDEX staff_leave_requests_requester_idx ON staff_leave_requests (organization_id, requester_user_id, created_at DESC);
CREATE INDEX staff_leave_requests_pending_idx ON staff_leave_requests (organization_id, status, created_at ASC);
