ALTER TABLE screening_results
  ADD COLUMN status_title_snapshot VARCHAR(4000) NOT NULL DEFAULT '',
  ADD COLUMN status_summary_snapshot VARCHAR(4000) NOT NULL DEFAULT '',
  ADD COLUMN next_step_snapshot VARCHAR(4000) NOT NULL DEFAULT '',
  ADD COLUMN disclaimer_text_snapshot VARCHAR(4000) NOT NULL DEFAULT '';
