CREATE TABLE revoked_access_tokens (
  id UUID PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX revoked_access_tokens_expires_at_idx ON revoked_access_tokens (expires_at);
