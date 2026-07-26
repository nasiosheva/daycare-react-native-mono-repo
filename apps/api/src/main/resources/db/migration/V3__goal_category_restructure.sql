-- Restructures the goal-template subsystem into a strict 3-layer model:
-- LearningLevel -> GoalCategory (one per learning level + domain) -> GoalCategoryItem.
-- Renames goal_templates -> goal_categories, goal_template_indicators -> goal_category_items,
-- extends learning_levels to support global (Platform Admin) rows, and consolidates the 138
-- single-item global goal_templates seeded in V1 into 24 grouped goal_categories (4 age bands x
-- 6 domains), each holding multiple goal_category_items.

-- 1. Rename tables and columns.
ALTER TABLE goal_templates RENAME TO goal_categories;
ALTER TABLE goal_categories RENAME COLUMN category TO domain;
ALTER TABLE goal_template_indicators RENAME TO goal_category_items;
ALTER TABLE goal_category_items RENAME COLUMN goal_template_id TO goal_category_id;
ALTER TABLE child_goals RENAME COLUMN template_id TO category_id;
ALTER TABLE curriculum_program_goal_templates RENAME TO curriculum_program_goal_categories;
ALTER TABLE curriculum_program_goal_categories RENAME COLUMN goal_template_id TO goal_category_id;

ALTER INDEX goal_templates_organization_idx RENAME TO goal_categories_organization_idx;
ALTER INDEX goal_template_indicators_template_idx RENAME TO goal_category_items_category_idx;
ALTER INDEX child_goals_active_template_idx RENAME TO child_goals_active_category_idx;
ALTER INDEX curriculum_program_goal_templates_program_idx RENAME TO curriculum_program_goal_categories_program_idx;
ALTER INDEX curriculum_program_goal_templates_goal_idx RENAME TO curriculum_program_goal_categories_goal_idx;
DROP INDEX goal_templates_global_idx;

-- 2. Extend learning_levels to support global (Platform Admin) rows, mirroring goal_categories.
ALTER TABLE learning_levels ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE learning_levels ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX learning_levels_global_name_idx ON learning_levels (name) WHERE organization_id IS NULL;

-- 3. Create global LearningLevel rows for the 4 age bands used by the V1 seed data, so the
-- consolidated global goal_categories below have somewhere to point learning_level_id at.
INSERT INTO learning_levels (id, organization_id, name, min_age_months, max_age_months, display_order, is_template, active) VALUES
(gen_random_uuid(), NULL, 'Toddler (1-2 Tahun)', 12, 24, 0, true, true),
(gen_random_uuid(), NULL, 'Kelompok Bermain (2-3 Tahun)', 24, 36, 1, true, true),
(gen_random_uuid(), NULL, 'Kelompok A (3-4 Tahun)', 36, 48, 2, true, true),
(gen_random_uuid(), NULL, 'Kelompok B (4-5 Tahun)', 48, 60, 3, true, true);

-- 4. Consolidate: one goal_categories row per (age-band learning level, domain), reusing the
-- duration/percent/streak defaults already shared by every row in that domain.
INSERT INTO goal_categories (id, organization_id, learning_level_id, name, description, duration_days, minimum_yes_percent, minimum_yes_streak, domain, is_template, active, created_at)
SELECT
  gen_random_uuid(),
  NULL,
  level.id,
  CASE agg.domain
    WHEN 'KEMANDIRIAN' THEN 'Kemandirian'
    WHEN 'BAHASA_KOMUNIKASI' THEN 'Bahasa & Komunikasi'
    WHEN 'KOGNITIF' THEN 'Kognitif'
    WHEN 'MOTORIK_HALUS' THEN 'Motorik Halus'
    WHEN 'MOTORIK_KASAR' THEN 'Motorik Kasar'
    WHEN 'SOSIAL_EMOSI' THEN 'Sosial & Emosi'
  END,
  '',
  agg.duration_days, agg.minimum_yes_percent, agg.minimum_yes_streak, agg.domain, true, true, now()
FROM (
  SELECT DISTINCT ON (min_age_months, domain) min_age_months, max_age_months, domain, duration_days, minimum_yes_percent, minimum_yes_streak
  FROM goal_categories
  WHERE organization_id IS NULL
  ORDER BY min_age_months, domain
) agg
JOIN learning_levels level ON level.organization_id IS NULL AND level.is_template AND level.min_age_months = agg.min_age_months AND level.max_age_months = agg.max_age_months;

-- 5. Re-point every goal_category_item that belonged to one of the original 138 single-item
-- global rows to its new consolidated parent, then delete the now-redundant originals.
CREATE TEMP TABLE goal_category_migration_map AS
SELECT old_cat.id AS old_id, new_cat.id AS new_id
FROM goal_categories old_cat
JOIN learning_levels level ON level.organization_id IS NULL AND level.is_template AND level.min_age_months = old_cat.min_age_months AND level.max_age_months = old_cat.max_age_months
JOIN goal_categories new_cat ON new_cat.organization_id IS NULL AND new_cat.learning_level_id = level.id AND new_cat.domain = old_cat.domain AND new_cat.id != old_cat.id
WHERE old_cat.organization_id IS NULL AND old_cat.min_age_months IS NOT NULL;

UPDATE goal_category_items item
SET goal_category_id = map.new_id
FROM goal_category_migration_map map
WHERE item.goal_category_id = map.old_id;

DELETE FROM goal_categories WHERE id IN (SELECT old_id FROM goal_category_migration_map);

DROP TABLE goal_category_migration_map;

-- 6. Backfill any tenant-owned row that was scoped only via classroom_id (never learning_level_id)
-- before learning_level_id becomes mandatory, and default any missing domain.
UPDATE goal_categories gc
SET learning_level_id = c.learning_level_id
FROM classrooms c
WHERE gc.classroom_id = c.id AND gc.learning_level_id IS NULL AND c.learning_level_id IS NOT NULL;

UPDATE goal_categories SET domain = 'KEMANDIRIAN' WHERE domain IS NULL;

-- 7. Drop fields superseded by the new model and enforce the "one category per learning level +
-- domain" rule. Global rows share organization_id = NULL, so a plain UNIQUE constraint would not
-- catch duplicates among them (NULLs never equal each other) - use two partial unique indexes.
ALTER TABLE goal_categories DROP CONSTRAINT goal_templates_scope;
ALTER TABLE goal_categories ALTER COLUMN learning_level_id SET NOT NULL;
ALTER TABLE goal_categories ALTER COLUMN domain SET NOT NULL;
ALTER TABLE goal_categories DROP COLUMN classroom_id;
ALTER TABLE goal_categories DROP COLUMN min_age_months;
ALTER TABLE goal_categories DROP COLUMN max_age_months;
CREATE UNIQUE INDEX goal_categories_tenant_scope_idx ON goal_categories (organization_id, learning_level_id, domain) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX goal_categories_global_scope_idx ON goal_categories (learning_level_id, domain) WHERE organization_id IS NULL;
