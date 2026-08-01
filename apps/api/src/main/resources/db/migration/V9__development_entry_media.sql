CREATE TABLE development_entry_media (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  development_entry_id UUID NOT NULL REFERENCES development_entries(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  data BYTEA NOT NULL,
  duration_ms INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX development_entry_media_entry_idx ON development_entry_media (development_entry_id, display_order);
