ALTER TABLE users ADD COLUMN username VARCHAR(64);
ALTER TABLE users ADD COLUMN local_password_hash VARCHAR(255);

CREATE UNIQUE INDEX users_username_lower_unique ON users (LOWER(username)) WHERE username IS NOT NULL;
