-- The reference curriculum (4 global LearningLevel age bands, 24 GoalCategory rows, 138
-- GoalCategoryItem milestones) was originally inserted directly by V1/V3 as part of the schema
-- build, so a fresh migration run always produced this content whether it was wanted or not.
-- Schema migrations should only build structure - seeding this specific reference content is now
-- a separate, explicit, idempotent step (see GlobalCurriculumSeeder.kt /
-- db/seed/global-curriculum-seed.sql), so a plain schema build stays empty unless the seed is
-- deliberately run. This migration removes the rows V1/V3 already inserted, scoped precisely to
-- the known seeded age-band names so it cannot touch any other global data.

DELETE FROM goal_category_items
WHERE goal_category_id IN (
  SELECT gc.id FROM goal_categories gc
  JOIN learning_levels ll ON ll.id = gc.learning_level_id
  WHERE gc.organization_id IS NULL AND gc.is_template = true
    AND ll.organization_id IS NULL AND ll.is_template = true
    AND ll.name IN ('Toddler (1-2 Tahun)', 'Kelompok Bermain (2-3 Tahun)', 'Kelompok A (3-4 Tahun)', 'Kelompok B (4-5 Tahun)')
);

DELETE FROM goal_categories gc
USING learning_levels ll
WHERE gc.learning_level_id = ll.id AND gc.organization_id IS NULL AND gc.is_template = true
  AND ll.organization_id IS NULL AND ll.is_template = true
  AND ll.name IN ('Toddler (1-2 Tahun)', 'Kelompok Bermain (2-3 Tahun)', 'Kelompok A (3-4 Tahun)', 'Kelompok B (4-5 Tahun)');

DELETE FROM learning_levels
WHERE organization_id IS NULL AND is_template = true
  AND name IN ('Toddler (1-2 Tahun)', 'Kelompok Bermain (2-3 Tahun)', 'Kelompok A (3-4 Tahun)', 'Kelompok B (4-5 Tahun)');
