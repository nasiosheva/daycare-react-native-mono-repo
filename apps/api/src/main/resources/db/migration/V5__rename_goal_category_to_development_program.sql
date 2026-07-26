-- Renames the "GoalCategory" terminology to "DevelopmentProgram" ("Program Perkembangan") to
-- avoid colliding with the separate, pre-existing "Program Kurikulum" (curriculum_programs)
-- feature. LearningLevel and the GoalDomain classification (Kemandirian/Bahasa dst.) are
-- unchanged - only layers 2 and 3 of the structure are renamed. Also adds optional note/photo/
-- audio attachment columns to child_goal_check_ins so staff can attach more than yes/no when
-- checking in a child.

ALTER TABLE goal_categories RENAME TO development_programs;
ALTER TABLE goal_category_items RENAME TO development_program_items;
ALTER TABLE development_program_items RENAME COLUMN goal_category_id TO development_program_id;
ALTER TABLE child_goals RENAME COLUMN category_id TO program_id;
ALTER TABLE curriculum_program_goal_categories RENAME TO curriculum_program_development_programs;
ALTER TABLE curriculum_program_development_programs RENAME COLUMN goal_category_id TO development_program_id;

ALTER INDEX goal_categories_global_scope_idx RENAME TO development_programs_global_scope_idx;
ALTER INDEX goal_categories_tenant_scope_idx RENAME TO development_programs_tenant_scope_idx;
ALTER INDEX goal_categories_organization_idx RENAME TO development_programs_organization_idx;
ALTER INDEX goal_category_items_category_idx RENAME TO development_program_items_program_idx;
ALTER INDEX child_goals_active_category_idx RENAME TO child_goals_active_program_idx;

ALTER TABLE child_goal_check_ins
  ADD COLUMN note VARCHAR(500),
  ADD COLUMN photo_content_type VARCHAR(50),
  ADD COLUMN photo_data BYTEA,
  ADD COLUMN audio_content_type VARCHAR(50),
  ADD COLUMN audio_data BYTEA,
  ADD COLUMN audio_duration_ms INTEGER;
