ALTER TABLE development_entries
    ADD COLUMN photo_content_type VARCHAR(50),
    ADD COLUMN photo_data BYTEA;
