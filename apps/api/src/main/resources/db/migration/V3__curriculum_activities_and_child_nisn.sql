CREATE TABLE curriculum_activities (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT curriculum_activities_unique UNIQUE (organization_id, name)
);
CREATE INDEX curriculum_activities_organization_idx ON curriculum_activities (organization_id, created_at DESC);

CREATE TABLE curriculum_activity_assessments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  activity_id UUID NOT NULL REFERENCES curriculum_activities(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT curriculum_activity_assessments_unique UNIQUE (activity_id, name)
);
CREATE INDEX curriculum_activity_assessments_activity_idx ON curriculum_activity_assessments (organization_id, activity_id, created_at DESC);

ALTER TABLE children ADD COLUMN nisn VARCHAR(20);
