ALTER TABLE parent_enrollments
    ALTER COLUMN invoice_id DROP NOT NULL,
    ALTER COLUMN entitlement_id DROP NOT NULL,
    ADD COLUMN selected_plan_id UUID,
    ADD COLUMN selected_plan_name VARCHAR(200),
    ADD COLUMN selected_plan_type VARCHAR(20),
    ADD COLUMN selected_subtotal_amount NUMERIC(14,2),
    ADD COLUMN selected_discount_amount NUMERIC(14,2),
    ADD COLUMN selected_discount_name VARCHAR(200),
    ADD COLUMN selected_discount_code VARCHAR(80),
    ADD COLUMN selected_total_amount NUMERIC(14,2),
    ADD COLUMN selected_credit_count INTEGER,
    ADD COLUMN selected_unused_credit_policy VARCHAR(20),
    ADD COLUMN selected_carry_forward_days INTEGER,
    ADD COLUMN selected_booking_requires_approval BOOLEAN;

UPDATE parent_enrollments enrollment
SET selected_plan_id = entitlement.plan_id,
    selected_plan_name = entitlement.plan_name,
    selected_plan_type = entitlement.plan_type,
    selected_subtotal_amount = invoice.subtotal_amount,
    selected_discount_amount = invoice.discount_amount,
    selected_discount_name = invoice.discount_name,
    selected_discount_code = invoice.discount_code,
    selected_total_amount = invoice.total_amount,
    selected_credit_count = entitlement.total_credits,
    selected_booking_requires_approval = entitlement.booking_requires_approval
FROM invoices invoice
JOIN service_entitlements entitlement ON entitlement.invoice_id = invoice.id
WHERE enrollment.invoice_id = invoice.id;

ALTER TABLE parent_enrollments
    ALTER COLUMN selected_plan_id SET NOT NULL,
    ALTER COLUMN selected_plan_name SET NOT NULL,
    ALTER COLUMN selected_plan_type SET NOT NULL,
    ALTER COLUMN selected_subtotal_amount SET NOT NULL,
    ALTER COLUMN selected_discount_amount SET NOT NULL,
    ALTER COLUMN selected_total_amount SET NOT NULL,
    ALTER COLUMN selected_booking_requires_approval SET NOT NULL;

UPDATE parent_enrollments
SET status = 'PENDING_APPROVAL'
WHERE status = 'PENDING_PAYMENT';

CREATE TABLE tenant_payment_instructions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    account_holder VARCHAR(200) NOT NULL,
    account_number VARCHAR(200) NOT NULL,
    note VARCHAR(500),
    active BOOLEAN NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX tenant_payment_instructions_organization_idx ON tenant_payment_instructions(organization_id, active, display_order);
