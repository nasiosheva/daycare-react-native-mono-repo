ALTER TABLE screening_templates
  ADD COLUMN rule_set_id UUID REFERENCES screening_rule_sets(id);

ALTER TABLE screening_answers
  ADD COLUMN context_code VARCHAR(120);
