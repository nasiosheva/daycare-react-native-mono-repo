CREATE TABLE screening_seed_manifests (
  id UUID PRIMARY KEY,
  batch_id VARCHAR(120) NOT NULL UNIQUE,
  seed_version VARCHAR(80) NOT NULL,
  checksum VARCHAR(128) NOT NULL,
  status VARCHAR(20) NOT NULL,
  applied_by VARCHAR(200) NOT NULL,
  template_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  choice_count INTEGER NOT NULL,
  translation_count INTEGER NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE screening_templates (
  id UUID PRIMARY KEY,
  code VARCHAR(120) NOT NULL,
  version INTEGER NOT NULL,
  min_age_months INTEGER NOT NULL,
  max_age_months INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  provenance VARCHAR(20) NOT NULL,
  seed_manifest_id UUID REFERENCES screening_seed_manifests(id),
  rule_version INTEGER NOT NULL,
  checksum VARCHAR(128) NOT NULL,
  copied_from_id UUID REFERENCES screening_templates(id),
  revision BIGINT NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id),
  published_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  retired_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT screening_templates_age_range_ck CHECK (min_age_months >= 0 AND max_age_months >= min_age_months),
  CONSTRAINT screening_templates_code_version_uk UNIQUE (code, version)
);
CREATE INDEX screening_templates_status_age_idx ON screening_templates (status, min_age_months, max_age_months);

CREATE TABLE screening_questions (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES screening_templates(id),
  stable_question_id VARCHAR(120) NOT NULL,
  domain VARCHAR(80) NOT NULL,
  subdomain VARCHAR(120),
  answer_type VARCHAR(32) NOT NULL,
  required BOOLEAN NOT NULL,
  needs_opportunity BOOLEAN NOT NULL,
  informational_only BOOLEAN NOT NULL,
  display_order INTEGER NOT NULL,
  min_age_months INTEGER,
  max_age_months INTEGER,
  condition_code VARCHAR(120),
  observation_instruction VARCHAR(2000),
  source_version VARCHAR(120),
  review_status VARCHAR(20) NOT NULL,
  seed_manifest_id UUID REFERENCES screening_seed_manifests(id),
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT screening_questions_template_stable_uk UNIQUE (template_id, stable_question_id),
  CONSTRAINT screening_questions_age_range_ck CHECK (min_age_months IS NULL OR max_age_months IS NULL OR max_age_months >= min_age_months)
);
CREATE INDEX screening_questions_template_order_idx ON screening_questions (template_id, display_order);

CREATE TABLE screening_choices (
  id UUID PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES screening_questions(id),
  code VARCHAR(64) NOT NULL,
  display_order INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL,
  seed_manifest_id UUID REFERENCES screening_seed_manifests(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT screening_choices_question_code_uk UNIQUE (question_id, code)
);
CREATE INDEX screening_choices_question_order_idx ON screening_choices (question_id, display_order);

CREATE TABLE screening_catalog_texts (
  id UUID PRIMARY KEY,
  resource_type VARCHAR(20) NOT NULL,
  resource_id UUID NOT NULL,
  locale VARCHAR(16) NOT NULL,
  text_key VARCHAR(120) NOT NULL,
  text_value VARCHAR(4000) NOT NULL,
  seed_manifest_id UUID REFERENCES screening_seed_manifests(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT screening_catalog_texts_resource_locale_key_uk UNIQUE (resource_type, resource_id, locale, text_key)
);
CREATE INDEX screening_catalog_texts_resource_idx ON screening_catalog_texts (resource_type, resource_id, locale);
