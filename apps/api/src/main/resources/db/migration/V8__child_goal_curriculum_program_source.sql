ALTER TABLE child_goals
    ADD COLUMN curriculum_program_id UUID REFERENCES curriculum_programs(id);

CREATE INDEX child_goals_curriculum_program_idx
    ON child_goals (curriculum_program_id);
