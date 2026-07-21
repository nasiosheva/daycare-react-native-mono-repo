CREATE TABLE development_entries (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content VARCHAR(2000) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX development_entries_child_idx ON development_entries (organization_id, child_id, recorded_at DESC);
