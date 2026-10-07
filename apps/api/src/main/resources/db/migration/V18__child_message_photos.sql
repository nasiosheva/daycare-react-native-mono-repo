-- Optional single photo per chat message. The bytes live in their own table so
-- listing a thread never loads image data; photo_content_type on the message
-- marks which messages carry a photo.
ALTER TABLE child_messages
  ADD COLUMN photo_content_type VARCHAR(50) NULL;

CREATE TABLE child_message_photos (
  message_id UUID PRIMARY KEY REFERENCES child_messages(id) ON DELETE CASCADE,
  data BYTEA NOT NULL
);
