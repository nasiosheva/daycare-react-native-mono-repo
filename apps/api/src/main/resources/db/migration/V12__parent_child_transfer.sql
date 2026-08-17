ALTER TABLE parent_enrollments ADD COLUMN transferred_from_child_id UUID REFERENCES children(id);
CREATE INDEX parent_enrollments_transferred_from_child_idx ON parent_enrollments (transferred_from_child_id) WHERE transferred_from_child_id IS NOT NULL;
