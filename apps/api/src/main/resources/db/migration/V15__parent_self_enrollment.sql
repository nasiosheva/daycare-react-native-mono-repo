CREATE TABLE parent_enrollments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    child_id UUID NOT NULL REFERENCES children(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    entitlement_id UUID NOT NULL REFERENCES service_entitlements(id),
    status VARCHAR(40) NOT NULL,
    rejection_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX parent_enrollments_invoice_unique ON parent_enrollments(invoice_id);
CREATE INDEX parent_enrollments_org_status_idx ON parent_enrollments(organization_id, status, created_at);
CREATE INDEX parent_enrollments_user_idx ON parent_enrollments(user_id, created_at);

ALTER TABLE children ADD COLUMN enrollment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE notifications ADD COLUMN action_path VARCHAR(160);
