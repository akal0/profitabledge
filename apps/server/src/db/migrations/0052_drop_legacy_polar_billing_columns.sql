DROP INDEX IF EXISTS "billing_customer_polar_customer_idx";
DROP INDEX IF EXISTS "billing_customer_polar_external_idx";
DROP INDEX IF EXISTS "billing_subscription_polar_subscription_idx";
DROP INDEX IF EXISTS "billing_order_polar_order_idx";
DROP INDEX IF EXISTS "affiliate_commission_event_order_idx";

ALTER TABLE "billing_customer"
  DROP COLUMN IF EXISTS "polar_customer_id",
  DROP COLUMN IF EXISTS "polar_external_id";

ALTER TABLE "billing_subscription"
  DROP COLUMN IF EXISTS "polar_subscription_id",
  DROP COLUMN IF EXISTS "polar_customer_id",
  DROP COLUMN IF EXISTS "polar_checkout_id",
  DROP COLUMN IF EXISTS "polar_product_id";

ALTER TABLE "billing_order"
  DROP COLUMN IF EXISTS "polar_order_id",
  DROP COLUMN IF EXISTS "polar_customer_id",
  DROP COLUMN IF EXISTS "polar_subscription_id",
  DROP COLUMN IF EXISTS "polar_checkout_id",
  DROP COLUMN IF EXISTS "polar_product_id";

ALTER TABLE "referral_reward_grant"
  DROP COLUMN IF EXISTS "polar_discount_id",
  DROP COLUMN IF EXISTS "polar_discount_code";

ALTER TABLE "affiliate_offer"
  DROP COLUMN IF EXISTS "polar_discount_id";

ALTER TABLE "affiliate_commission_event"
  DROP COLUMN IF EXISTS "polar_order_id",
  DROP COLUMN IF EXISTS "polar_subscription_id";
