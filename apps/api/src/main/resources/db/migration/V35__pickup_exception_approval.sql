CREATE TABLE pickup_exception_requests (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  requested_by_user_id UUID NOT NULL REFERENCES users(id),
  pickup_person_name VARCHAR(160) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  request_expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL,
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  verification_method VARCHAR(48),
  verification_note VARCHAR(500),
  approval_expires_at TIMESTAMPTZ,
  rejection_reason VARCHAR(500),
  consumed_at TIMESTAMPTZ,
  CONSTRAINT pickup_exception_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONSUMED')),
  CONSTRAINT pickup_exception_requests_request_expiry CHECK (request_expires_at > requested_at),
  CONSTRAINT pickup_exception_requests_approval_fields CHECK (
    status <> 'APPROVED' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND verification_method IS NOT NULL AND verification_note IS NOT NULL AND approval_expires_at IS NOT NULL)
  )
);
CREATE INDEX pickup_exception_requests_pending_idx ON pickup_exception_requests (organization_id, status, requested_at);
CREATE INDEX pickup_exception_requests_child_idx ON pickup_exception_requests (organization_id, child_id, requested_at DESC);
CREATE UNIQUE INDEX pickup_exception_requests_one_pending_per_child
  ON pickup_exception_requests (organization_id, child_id)
  WHERE status = 'PENDING';

ALTER TABLE attendance_records
  ADD COLUMN pickup_exception_request_id UUID REFERENCES pickup_exception_requests(id);
CREATE UNIQUE INDEX attendance_pickup_exception_request_unique
  ON attendance_records (pickup_exception_request_id)
  WHERE pickup_exception_request_id IS NOT NULL;
