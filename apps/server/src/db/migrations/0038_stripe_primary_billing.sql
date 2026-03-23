ALTER TABLE "billing_customer"
  ALTER COLUMN "polar_customer_id" DROP NOT NULL,
  ALTER COLUMN "polar_external_id" DROP NOT NULL;

ALTER TABLE "billing_customer"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(24) NOT NULL DEFAULT 'polar',
  ADD COLUMN IF NOT EXISTS "provider_customer_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_default_payment_method_id" VARCHAR(120);

UPDATE "billing_customer"
SET
  "provider" = COALESCE("provider", 'polar'),
  "provider_customer_id" = COALESCE("provider_customer_id", "polar_customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "billing_customer_provider_customer_idx"
  ON "billing_customer"("provider_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_customer_stripe_customer_idx"
  ON "billing_customer"("stripe_customer_id");

ALTER TABLE "billing_subscription"
  ALTER COLUMN "polar_subscription_id" DROP NOT NULL;

ALTER TABLE "billing_subscription"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(24) NOT NULL DEFAULT 'polar',
  ADD COLUMN IF NOT EXISTS "provider_subscription_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_customer_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_checkout_session_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_price_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_product_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_price_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_product_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_latest_invoice_id" VARCHAR(120);

UPDATE "billing_subscription"
SET
  "provider" = COALESCE("provider", 'polar'),
  "provider_subscription_id" = COALESCE("provider_subscription_id", "polar_subscription_id"),
  "provider_customer_id" = COALESCE("provider_customer_id", "polar_customer_id"),
  "provider_checkout_session_id" = COALESCE("provider_checkout_session_id", "polar_checkout_id"),
  "provider_product_id" = COALESCE("provider_product_id", "polar_product_id");

CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscription_provider_subscription_idx"
  ON "billing_subscription"("provider_subscription_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscription_stripe_subscription_idx"
  ON "billing_subscription"("stripe_subscription_id");

ALTER TABLE "billing_order"
  ALTER COLUMN "polar_order_id" DROP NOT NULL;

ALTER TABLE "billing_order"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(24) NOT NULL DEFAULT 'polar',
  ADD COLUMN IF NOT EXISTS "provider_order_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_customer_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_subscription_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_checkout_session_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_invoice_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_payment_intent_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_charge_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_price_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_product_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_invoice_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_charge_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_price_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_product_id" VARCHAR(120);

UPDATE "billing_order"
SET
  "provider" = COALESCE("provider", 'polar'),
  "provider_order_id" = COALESCE("provider_order_id", "polar_order_id"),
  "provider_customer_id" = COALESCE("provider_customer_id", "polar_customer_id"),
  "provider_subscription_id" = COALESCE("provider_subscription_id", "polar_subscription_id"),
  "provider_checkout_session_id" = COALESCE("provider_checkout_session_id", "polar_checkout_id"),
  "provider_product_id" = COALESCE("provider_product_id", "polar_product_id");

CREATE UNIQUE INDEX IF NOT EXISTS "billing_order_provider_order_idx"
  ON "billing_order"("provider_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_order_stripe_invoice_idx"
  ON "billing_order"("stripe_invoice_id");

ALTER TABLE "billing_webhook_event"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(24) NOT NULL DEFAULT 'polar',
  ADD COLUMN IF NOT EXISTS "provider_event_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "provider_object_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "processing_status" VARCHAR(32) NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT;

UPDATE "billing_webhook_event"
SET
  "provider" = COALESCE("provider", 'polar'),
  "provider_object_id" = COALESCE("provider_object_id", "object_id"),
  "processed_at" = COALESCE("processed_at", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "billing_webhook_event_provider_event_idx"
  ON "billing_webhook_event"("provider", "provider_event_id");

ALTER TABLE "referral_reward_grant"
  ADD COLUMN IF NOT EXISTS "discount_provider" VARCHAR(24),
  ADD COLUMN IF NOT EXISTS "provider_discount_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_discount_code" VARCHAR(128);

UPDATE "referral_reward_grant"
SET
  "discount_provider" = COALESCE("discount_provider", CASE WHEN "polar_discount_id" IS NOT NULL THEN 'polar' ELSE NULL END),
  "provider_discount_id" = COALESCE("provider_discount_id", "polar_discount_id"),
  "provider_discount_code" = COALESCE("provider_discount_code", "polar_discount_code");

ALTER TABLE "affiliate_offer"
  ADD COLUMN IF NOT EXISTS "discount_provider" VARCHAR(24),
  ADD COLUMN IF NOT EXISTS "provider_discount_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_promotion_code_id" VARCHAR(120);

UPDATE "affiliate_offer"
SET
  "discount_provider" = COALESCE("discount_provider", CASE WHEN "polar_discount_id" IS NOT NULL THEN 'polar' ELSE NULL END),
  "provider_discount_id" = COALESCE("provider_discount_id", "polar_discount_id");

ALTER TABLE "affiliate_commission_event"
  ALTER COLUMN "polar_order_id" DROP NOT NULL;

ALTER TABLE "affiliate_commission_event"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(24) NOT NULL DEFAULT 'polar',
  ADD COLUMN IF NOT EXISTS "provider_order_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "provider_subscription_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "billing_order_id" TEXT REFERENCES "billing_order"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "stripe_invoice_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(120);

UPDATE "affiliate_commission_event"
SET
  "provider" = COALESCE("provider", 'polar'),
  "provider_order_id" = COALESCE("provider_order_id", "polar_order_id"),
  "provider_subscription_id" = COALESCE("provider_subscription_id", "polar_subscription_id");

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_commission_event_provider_order_idx"
  ON "affiliate_commission_event"("provider", "provider_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_commission_event_stripe_invoice_idx"
  ON "affiliate_commission_event"("stripe_invoice_id");
