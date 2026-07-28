CREATE TABLE parent_family_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  husband_date_of_birth DATE,
  husband_occupation VARCHAR(32),
  husband_income_range VARCHAR(32),
  wife_date_of_birth DATE,
  wife_occupation VARCHAR(32),
  wife_income_range VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
