ALTER TABLE memberships
    ADD COLUMN can_manage_child_programs BOOLEAN NOT NULL DEFAULT FALSE;
