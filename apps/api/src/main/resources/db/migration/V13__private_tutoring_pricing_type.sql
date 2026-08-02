ALTER TABLE private_tutoring_services
  ADD COLUMN daily_price NUMERIC(14,2),
  ADD COLUMN weekly_price NUMERIC(14,2),
  ADD COLUMN monthly_price NUMERIC(14,2);

UPDATE private_tutoring_services SET daily_price = price;

ALTER TABLE private_tutoring_services DROP CONSTRAINT private_tutoring_services_price;
ALTER TABLE private_tutoring_services DROP COLUMN price;

ALTER TABLE private_tutoring_services
  ADD CONSTRAINT private_tutoring_services_prices_positive CHECK (
    (daily_price IS NULL OR daily_price > 0)
    AND (weekly_price IS NULL OR weekly_price > 0)
    AND (monthly_price IS NULL OR monthly_price > 0)
  ),
  ADD CONSTRAINT private_tutoring_services_has_price CHECK (
    daily_price IS NOT NULL OR weekly_price IS NOT NULL OR monthly_price IS NOT NULL
  );

ALTER TABLE private_tutoring_requests
  ADD COLUMN pricing_type VARCHAR(16) NOT NULL DEFAULT 'DAILY';

ALTER TABLE private_tutoring_requests
  ADD CONSTRAINT private_tutoring_requests_pricing_type CHECK (pricing_type IN ('DAILY', 'WEEKLY', 'MONTHLY'));
