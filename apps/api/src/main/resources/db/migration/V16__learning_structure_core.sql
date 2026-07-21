ALTER TABLE curriculum_programs ALTER COLUMN academic_year_id DROP NOT NULL;

CREATE TABLE learning_levels (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(120) NOT NULL,
  min_age_months INTEGER,
  max_age_months INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT learning_levels_age_range CHECK (
    min_age_months IS NULL OR max_age_months IS NULL OR min_age_months <= max_age_months
  ),
  CONSTRAINT learning_levels_organization_name UNIQUE (organization_id, name)
);

CREATE TABLE learning_level_curriculum_programs (
  id UUID PRIMARY KEY,
  learning_level_id UUID NOT NULL REFERENCES learning_levels(id) ON DELETE CASCADE,
  curriculum_program_id UUID NOT NULL REFERENCES curriculum_programs(id) ON DELETE CASCADE,
  CONSTRAINT learning_level_curriculum_programs_unique UNIQUE (learning_level_id, curriculum_program_id)
);

ALTER TABLE classrooms ADD COLUMN learning_level_id UUID REFERENCES learning_levels(id);
ALTER TABLE classrooms ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE classrooms ADD COLUMN capacity INTEGER;
ALTER TABLE classrooms ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE classrooms ADD CONSTRAINT classrooms_capacity_positive CHECK (capacity IS NULL OR capacity > 0);

CREATE TABLE child_placements (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id),
  learning_level_id UUID REFERENCES learning_levels(id),
  academic_year_id UUID REFERENCES academic_years(id),
  starts_on DATE NOT NULL,
  ended_on DATE,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_placements_dates CHECK (ended_on IS NULL OR ended_on >= starts_on)
);
CREATE UNIQUE INDEX child_placements_active_child_idx ON child_placements (child_id) WHERE ended_on IS NULL;
CREATE INDEX child_placements_classroom_active_idx ON child_placements (classroom_id) WHERE ended_on IS NULL;
CREATE INDEX child_placements_organization_child_idx ON child_placements (organization_id, child_id, starts_on DESC);

INSERT INTO child_placements (id, organization_id, child_id, classroom_id, learning_level_id, academic_year_id, starts_on, created_at)
SELECT gen_random_uuid(), children.organization_id, children.id, classrooms.id, classrooms.learning_level_id, classrooms.academic_year_id, CURRENT_DATE, CURRENT_TIMESTAMP
FROM children
JOIN classrooms ON classrooms.id = children.classroom_id
WHERE children.enrollment_status = 'ACTIVE';

CREATE TABLE classroom_staff_assignments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id),
  user_id UUID NOT NULL REFERENCES users(id),
  assignment_role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT classroom_staff_assignments_unique UNIQUE (classroom_id, user_id)
);
CREATE INDEX classroom_staff_assignments_user_idx ON classroom_staff_assignments (organization_id, user_id);
