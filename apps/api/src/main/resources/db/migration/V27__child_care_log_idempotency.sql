-- Mories Deo Hutapea,S.E.,S.Kom
ALTER TABLE child_care_logs ADD COLUMN client_mutation_id UUID;
CREATE UNIQUE INDEX uk_child_care_logs_organization_client_mutation
    ON child_care_logs (organization_id, client_mutation_id)
    WHERE client_mutation_id IS NOT NULL;
