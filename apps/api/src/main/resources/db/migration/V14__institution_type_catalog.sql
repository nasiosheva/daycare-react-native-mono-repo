CREATE TABLE institution_type_definitions (
  code VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX institution_type_definitions_name_unique
  ON institution_type_definitions (LOWER(name));

INSERT INTO institution_type_definitions (code, name, active) VALUES
  ('DAYCARE', 'Daycare', TRUE),
  ('PAUD', 'PAUD', TRUE),
  ('TK', 'Taman kanak-kanak', TRUE)
ON CONFLICT (code) DO NOTHING;
