CREATE TABLE child_messages (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id),
  sender_role VARCHAR(20) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX child_messages_child_idx ON child_messages (child_id, created_at ASC);

CREATE TABLE child_message_reads (
  id UUID PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  last_read_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT child_message_reads_unique UNIQUE (child_id, user_id)
);
