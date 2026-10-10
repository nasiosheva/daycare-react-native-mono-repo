CREATE TABLE screening_rule_sets (
  id UUID PRIMARY KEY,
  code VARCHAR(120) NOT NULL,
  version INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  provenance VARCHAR(20) NOT NULL,
  checksum VARCHAR(128) NOT NULL,
  review_status VARCHAR(20) NOT NULL,
  seed_manifest_id UUID REFERENCES screening_seed_manifests(id),
  revision BIGINT NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id),
  published_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  retired_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT screening_rule_sets_code_version_uk UNIQUE (code, version)
);

CREATE TABLE screening_rule_triggers (
  id UUID PRIMARY KEY,
  rule_set_id UUID NOT NULL REFERENCES screening_rule_sets(id),
  trigger_kind VARCHAR(20) NOT NULL,
  priority INTEGER NOT NULL,
  stable_question_id VARCHAR(120),
  answer_code VARCHAR(80),
  context_code VARCHAR(120),
  output_status VARCHAR(40),
  reason_code VARCHAR(80),
  domain_code VARCHAR(80),
  enabled BOOLEAN NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT screening_rule_triggers_priority_ck CHECK (priority >= 0),
  CONSTRAINT screening_rule_triggers_output_ck CHECK (output_status IS NOT NULL OR reason_code IS NOT NULL)
);
CREATE INDEX screening_rule_triggers_rule_order_idx ON screening_rule_triggers (rule_set_id, enabled, display_order);
