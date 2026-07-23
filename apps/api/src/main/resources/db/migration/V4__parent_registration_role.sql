ALTER TABLE users ADD COLUMN registration_role VARCHAR(20);

UPDATE users
SET registration_role = 'PARENT'
WHERE EXISTS (
    SELECT 1
    FROM memberships
    WHERE memberships.user_id = users.id
      AND memberships.role = 'PARENT'
);

ALTER TABLE users
    ADD CONSTRAINT users_registration_role_parent_check
    CHECK (registration_role IS NULL OR registration_role = 'PARENT');
