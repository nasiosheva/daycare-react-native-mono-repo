CREATE TABLE payment_proofs (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id),
  status VARCHAR(20) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  image_data BYTEA NOT NULL,
  note VARCHAR(500),
  submitted_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id),
  rejection_reason VARCHAR(500)
);
