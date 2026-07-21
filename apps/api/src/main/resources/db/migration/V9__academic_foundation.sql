CREATE TABLE academic_years (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(80) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  active BOOLEAN NOT NULL
);

CREATE TABLE curriculum_programs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL
);

CREATE INDEX academic_years_organization_idx ON academic_years (organization_id, starts_on DESC);
CREATE INDEX curriculum_programs_organization_idx ON curriculum_programs (organization_id, name);
