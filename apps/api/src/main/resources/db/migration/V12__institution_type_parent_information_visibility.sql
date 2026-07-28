ALTER TABLE institution_type_definitions
  ADD COLUMN IF NOT EXISTS parent_occupation_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_income_range_visible BOOLEAN NOT NULL DEFAULT FALSE;
