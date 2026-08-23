CREATE TABLE child_health_notes (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id),
  note VARCHAR(2000) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_health_notes_child_idx ON child_health_notes (child_id, recorded_at DESC);
