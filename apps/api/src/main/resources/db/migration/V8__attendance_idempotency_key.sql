ALTER TABLE attendance_records
  ADD COLUMN check_in_idempotency_key VARCHAR(100),
  ADD COLUMN check_out_idempotency_key VARCHAR(100);
