ALTER TABLE development_programs
  ADD COLUMN revised_from_program_id UUID REFERENCES development_programs(id),
  ADD COLUMN revision_number INTEGER NOT NULL DEFAULT 1;
CREATE INDEX development_programs_revision_source_idx ON development_programs (revised_from_program_id);

CREATE TABLE platform_knowledge_candidates (
  id UUID PRIMARY KEY,
  normalized_key VARCHAR(512) NOT NULL UNIQUE,
  topic_name VARCHAR(120) NOT NULL,
  learning_level_name VARCHAR(120) NOT NULL,
  min_age_months INTEGER,
  max_age_months INTEGER,
  domain VARCHAR(40) NOT NULL,
  duration_days INTEGER NOT NULL,
  indicator_names TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  supporting_tenant_count INTEGER NOT NULL,
  relevant_tenant_count INTEGER NOT NULL,
  support_percent INTEGER NOT NULL,
  minimum_tenant_threshold INTEGER NOT NULL,
  minimum_support_percent INTEGER NOT NULL,
  algorithm_version VARCHAR(40) NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id),
  review_reason VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX platform_knowledge_candidates_status_idx ON platform_knowledge_candidates (status, updated_at DESC);
