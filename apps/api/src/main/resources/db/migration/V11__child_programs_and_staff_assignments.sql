CREATE TABLE child_programs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE child_staff_assignments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  assignment_role VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_staff_assignments_child_user_unique UNIQUE (child_id, user_id)
);

CREATE INDEX child_programs_child_idx ON child_programs (organization_id, child_id, created_at DESC);
CREATE INDEX child_staff_assignments_child_idx ON child_staff_assignments (organization_id, child_id, created_at DESC);
