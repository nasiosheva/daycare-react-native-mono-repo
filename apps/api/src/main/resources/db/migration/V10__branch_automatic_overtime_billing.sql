ALTER TABLE branches
    ADD COLUMN auto_overtime_billing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN overtime_grace_minutes INTEGER NOT NULL DEFAULT 15,
    ADD CONSTRAINT branches_overtime_grace_minutes_check CHECK (overtime_grace_minutes BETWEEN 0 AND 180);
