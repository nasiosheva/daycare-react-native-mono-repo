-- Tenant-wide quick replies that Staff can insert into a child chat draft.
CREATE TABLE child_message_templates (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  body VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX child_message_templates_organization_idx ON child_message_templates (organization_id, created_at);
