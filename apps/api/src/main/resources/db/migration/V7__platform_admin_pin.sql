ALTER TABLE platform_administrators
  ADD COLUMN pin_hash VARCHAR(100),
  ADD COLUMN pin_changed_at TIMESTAMPTZ;
