ALTER TABLE tenant_subscriptions ADD COLUMN monthly_fee NUMERIC(14,2);

UPDATE tenant_subscriptions subscription
SET monthly_fee = payment.amount
FROM (
  SELECT DISTINCT ON (subscription_id) subscription_id, amount
  FROM tenant_payments
  ORDER BY subscription_id, created_at DESC
) payment
WHERE subscription.id = payment.subscription_id;
