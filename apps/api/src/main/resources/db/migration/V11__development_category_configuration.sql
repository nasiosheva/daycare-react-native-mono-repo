ALTER TABLE memberships ADD COLUMN can_manage_development_categories BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE development_entries ALTER COLUMN category TYPE VARCHAR(64);

CREATE TABLE development_categories (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX development_categories_organization_name_idx ON development_categories (organization_id, lower(name));
