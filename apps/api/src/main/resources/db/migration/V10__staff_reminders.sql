ALTER TABLE device_tokens ADD COLUMN installation_id VARCHAR(128);
ALTER TABLE device_tokens ADD COLUMN time_zone VARCHAR(64);
CREATE UNIQUE INDEX device_tokens_installation_id_unique ON device_tokens (installation_id) WHERE installation_id IS NOT NULL;

CREATE TABLE staff_reminders (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  hour INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  weekdays VARCHAR(32) NOT NULL,
  target_code VARCHAR(32) NOT NULL,
  action_path VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  rule_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT staff_reminders_hour_range CHECK (hour BETWEEN 0 AND 23),
  CONSTRAINT staff_reminders_minute_range CHECK (minute BETWEEN 0 AND 59)
);
CREATE INDEX staff_reminders_owner_idx ON staff_reminders (organization_id, user_id, created_at DESC);
CREATE INDEX staff_reminders_active_idx ON staff_reminders (active);

CREATE TABLE staff_reminder_device_schedules (
  id UUID PRIMARY KEY,
  reminder_id UUID NOT NULL REFERENCES staff_reminders(id) ON DELETE CASCADE,
  installation_id VARCHAR(128) NOT NULL,
  rule_version INTEGER NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT staff_reminder_device_schedules_unique UNIQUE (reminder_id, installation_id)
);
