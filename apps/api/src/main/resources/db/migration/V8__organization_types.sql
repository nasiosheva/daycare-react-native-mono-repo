CREATE TABLE organization_types (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  type_code VARCHAR(20) NOT NULL,
  UNIQUE (organization_id, type_code)
);

INSERT INTO organization_types (id, organization_id, type_code)
SELECT md5(random()::text || clock_timestamp()::text || id::text)::uuid, id, 'DAYCARE' FROM organizations;
