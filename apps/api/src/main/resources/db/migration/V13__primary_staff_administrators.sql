ALTER TABLE memberships ADD COLUMN primary_staff_admin BOOLEAN NOT NULL DEFAULT FALSE;

WITH ranked_staff_administrators AS (
    SELECT memberships.id,
           ROW_NUMBER() OVER (PARTITION BY memberships.organization_id ORDER BY users.created_at ASC, memberships.id ASC) AS position
    FROM memberships
    JOIN users ON users.id = memberships.user_id
    WHERE memberships.role = 'STAFF_ADMIN'
)
UPDATE memberships
SET primary_staff_admin = TRUE
FROM ranked_staff_administrators
WHERE memberships.id = ranked_staff_administrators.id
  AND ranked_staff_administrators.position = 1;

CREATE UNIQUE INDEX memberships_primary_staff_admin_organization_unique
    ON memberships (organization_id)
    WHERE primary_staff_admin = TRUE;
