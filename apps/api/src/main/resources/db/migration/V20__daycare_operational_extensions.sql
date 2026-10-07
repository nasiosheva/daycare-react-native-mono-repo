CREATE TABLE child_care_logs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  recorded_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
  care_type VARCHAR(20) NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  meal_type VARCHAR(20),
  meal_amount VARCHAR(20),
  nap_started_at TIMESTAMP WITH TIME ZONE,
  nap_ended_at TIMESTAMP WITH TIME ZONE,
  toilet_type VARCHAR(20),
  note VARCHAR(500),
  corrects_log_id UUID REFERENCES child_care_logs(id),
  correction_reason VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX child_care_logs_child_occurred_idx ON child_care_logs (organization_id, child_id, occurred_at DESC);

CREATE TABLE staff_handovers (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id),
  created_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
  recipient_user_id UUID NOT NULL REFERENCES user_profiles(id),
  summary VARCHAR(2000) NOT NULL,
  status VARCHAR(20) NOT NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX staff_handovers_child_created_idx ON staff_handovers (organization_id, child_id, created_at DESC);
CREATE INDEX staff_handovers_recipient_status_idx ON staff_handovers (organization_id, recipient_user_id, status);

CREATE TABLE tenant_announcements (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
  audience VARCHAR(20) NOT NULL,
  branch_id UUID REFERENCES branches(id),
  title VARCHAR(160) NOT NULL,
  body VARCHAR(4000) NOT NULL,
  requires_acknowledgement BOOLEAN NOT NULL,
  status VARCHAR(20) NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX tenant_announcements_scope_status_idx ON tenant_announcements (organization_id, status, published_at DESC);

CREATE TABLE tenant_announcement_recipients (
  id UUID PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES tenant_announcements(id),
  recipient_user_id UUID NOT NULL REFERENCES user_profiles(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE (announcement_id, recipient_user_id)
);
CREATE INDEX tenant_announcement_recipients_recipient_idx ON tenant_announcement_recipients (recipient_user_id, announcement_id);

CREATE TABLE service_expiry_reminder_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  lead_days VARCHAR(100) NOT NULL,
  updated_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE TABLE service_expiry_reminders (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entitlement_id UUID NOT NULL REFERENCES service_entitlements(id),
  lead_days INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE (entitlement_id, lead_days)
);

ALTER TABLE child_incident_reports
  ADD COLUMN incident_status VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
  ADD COLUMN guardian_contact_status VARCHAR(20) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN guardian_contact_outcome VARCHAR(2000),
  ADD COLUMN follow_up_owner_user_id UUID REFERENCES user_profiles(id),
  ADD COLUMN follow_up_due_on DATE,
  ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN closed_by_user_id UUID REFERENCES user_profiles(id);

CREATE TABLE child_incident_follow_ups (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  incident_id UUID NOT NULL REFERENCES child_incident_reports(id),
  created_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
  title VARCHAR(500) NOT NULL,
  note VARCHAR(2000),
  status VARCHAR(20) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by_user_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX child_incident_follow_ups_incident_idx ON child_incident_follow_ups (incident_id, status);
