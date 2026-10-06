ALTER TABLE child_messages
  ADD COLUMN reply_to_message_id UUID NULL REFERENCES child_messages(id) ON DELETE SET NULL;

CREATE INDEX child_messages_reply_to_idx ON child_messages (reply_to_message_id);
