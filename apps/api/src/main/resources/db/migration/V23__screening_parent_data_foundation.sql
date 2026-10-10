CREATE TABLE screening_child_profiles (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  subject_name VARCHAR(160) NOT NULL,
  date_of_birth DATE NOT NULL,
  premature_birth BOOLEAN,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX screening_child_profiles_owner_active_idx ON screening_child_profiles (owner_user_id, active, created_at DESC);

CREATE TABLE screening_sessions (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES screening_child_profiles(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  template_id UUID NOT NULL REFERENCES screening_templates(id),
  template_code VARCHAR(120) NOT NULL,
  template_version INTEGER NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  child_id UUID REFERENCES children(id),
  status VARCHAR(20) NOT NULL,
  locale VARCHAR(16) NOT NULL,
  observation_language VARCHAR(120),
  consent_version VARCHAR(80) NOT NULL,
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  age_months INTEGER NOT NULL,
  corrected_age_months INTEGER,
  subject_name_snapshot VARCHAR(160) NOT NULL,
  date_of_birth_snapshot DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT screening_sessions_scope_ck CHECK ((organization_id IS NULL AND child_id IS NULL) OR (organization_id IS NOT NULL AND child_id IS NOT NULL)),
  CONSTRAINT screening_sessions_age_ck CHECK (age_months >= 0 AND (corrected_age_months IS NULL OR corrected_age_months >= 0))
);
CREATE INDEX screening_sessions_owner_status_idx ON screening_sessions (owner_user_id, status, created_at DESC);
CREATE INDEX screening_sessions_profile_created_idx ON screening_sessions (profile_id, created_at DESC);

CREATE TABLE screening_answers (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES screening_sessions(id),
  question_id UUID NOT NULL REFERENCES screening_questions(id),
  stable_question_id VARCHAR(120) NOT NULL,
  answer_code VARCHAR(80) NOT NULL,
  note VARCHAR(2000),
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT screening_answers_session_question_uk UNIQUE (session_id, question_id)
);
CREATE INDEX screening_answers_session_order_idx ON screening_answers (session_id, answered_at, id);

CREATE TABLE screening_results (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE REFERENCES screening_sessions(id),
  template_id UUID NOT NULL REFERENCES screening_templates(id),
  template_code VARCHAR(120) NOT NULL,
  template_version INTEGER NOT NULL,
  rule_version INTEGER NOT NULL,
  locale VARCHAR(16) NOT NULL,
  main_status VARCHAR(40) NOT NULL,
  completeness_status VARCHAR(40) NOT NULL,
  disclaimer_version VARCHAR(80) NOT NULL,
  subject_name_snapshot VARCHAR(160) NOT NULL,
  date_of_birth_snapshot DATE NOT NULL,
  age_months INTEGER NOT NULL,
  corrected_age_months INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  review_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE screening_result_domains (
  id UUID PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES screening_results(id),
  domain_code VARCHAR(80) NOT NULL,
  status_code VARCHAR(40) NOT NULL,
  observed_count INTEGER NOT NULL,
  incomplete_count INTEGER NOT NULL,
  attention_count INTEGER NOT NULL,
  display_order INTEGER NOT NULL,
  CONSTRAINT screening_result_domains_result_domain_uk UNIQUE (result_id, domain_code)
);

CREATE TABLE screening_result_reasons (
  id UUID PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES screening_results(id),
  reason_code VARCHAR(80) NOT NULL,
  question_id UUID REFERENCES screening_questions(id),
  answer_id UUID REFERENCES screening_answers(id),
  stable_question_id VARCHAR(120),
  answer_code VARCHAR(80),
  domain_code VARCHAR(80),
  text_snapshot VARCHAR(4000) NOT NULL,
  display_order INTEGER NOT NULL
);
CREATE INDEX screening_result_reasons_result_order_idx ON screening_result_reasons (result_id, display_order);

CREATE TABLE screening_result_items (
  id UUID PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES screening_results(id),
  question_id UUID NOT NULL REFERENCES screening_questions(id),
  answer_id UUID REFERENCES screening_answers(id),
  stable_question_id VARCHAR(120) NOT NULL,
  domain_code VARCHAR(80) NOT NULL,
  question_text_snapshot VARCHAR(4000) NOT NULL,
  answer_code VARCHAR(80),
  answer_label_snapshot VARCHAR(1000),
  note_snapshot VARCHAR(2000),
  display_order INTEGER NOT NULL,
  CONSTRAINT screening_result_items_result_question_uk UNIQUE (result_id, question_id)
);
CREATE INDEX screening_result_items_result_order_idx ON screening_result_items (result_id, display_order);
