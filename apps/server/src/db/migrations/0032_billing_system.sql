CREATE TABLE IF NOT EXISTS "billing_customer" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "polar_customer_id" varchar(120) NOT NULL,
  "polar_external_id" varchar(120) NOT NULL,
  "email" text,
  "name" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_customer_user_idx" ON "billing_customer" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_customer_polar_customer_idx" ON "billing_customer" ("polar_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_customer_polar_external_idx" ON "billing_customer" ("polar_external_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_subscription" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "polar_subscription_id" varchar(120) NOT NULL,
  "polar_customer_id" varchar(120),
  "polar_checkout_id" varchar(120),
  "polar_product_id" varchar(120),
  "plan_key" varchar(40) NOT NULL,
  "status" varchar(40) NOT NULL,
  "currency" varchar(10),
  "amount" integer,
  "recurring_interval" varchar(20),
  "recurring_interval_count" integer,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "current_period_start" timestamp,
  "current_period_end" timestamp,
  "trial_start" timestamp,
  "trial_end" timestamp,
  "started_at" timestamp,
  "ends_at" timestamp,
  "ended_at" timestamp,
  "canceled_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_subscription_user_idx" ON "billing_subscription" ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscription_polar_subscription_idx" ON "billing_subscription" ("polar_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_subscription_status_period_idx" ON "billing_subscription" ("status","current_period_end");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_order" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "polar_order_id" varchar(120) NOT NULL,
  "polar_customer_id" varchar(120),
  "polar_subscription_id" varchar(120),
  "polar_checkout_id" varchar(120),
  "polar_product_id" varchar(120),
  "plan_key" varchar(40) NOT NULL,
  "status" varchar(40) NOT NULL,
  "currency" varchar(10),
  "subtotal_amount" integer,
  "discount_amount" integer,
  "tax_amount" integer,
  "total_amount" integer,
  "paid" boolean NOT NULL DEFAULT false,
  "paid_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_order_user_idx" ON "billing_order" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_order_polar_order_idx" ON "billing_order" ("polar_order_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_webhook_event" (
  "id" text PRIMARY KEY NOT NULL,
  "event_key" varchar(255) NOT NULL,
  "event_type" varchar(80) NOT NULL,
  "object_id" varchar(120),
  "payload" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_webhook_event_key_idx" ON "billing_webhook_event" ("event_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_webhook_event_type_idx" ON "billing_webhook_event" ("event_type","created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_profile" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "code" varchar(64) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_profile_user_idx" ON "affiliate_profile" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_profile_code_idx" ON "affiliate_profile" ("code");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_referral" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_profile_id" text NOT NULL REFERENCES "affiliate_profile"("id") ON DELETE cascade,
  "referrer_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referred_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referral_code" varchar(64) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'signed_up',
  "commission_bps" integer NOT NULL DEFAULT 2000,
  "commission_amount" integer,
  "converted_order_id" varchar(120),
  "converted_subscription_id" varchar(120),
  "converted_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_referral_referred_user_idx" ON "affiliate_referral" ("referred_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_referral_referrer_status_idx" ON "affiliate_referral" ("referrer_user_id","status","created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "private_beta_code" (
  "id" text PRIMARY KEY NOT NULL,
  "code" varchar(64) NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "max_redemptions" integer,
  "redeemed_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_beta_code_code_idx" ON "private_beta_code" ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_beta_code_active_idx" ON "private_beta_code" ("is_active","expires_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "private_beta_redemption" (
  "id" text PRIMARY KEY NOT NULL,
  "code_id" text NOT NULL REFERENCES "private_beta_code"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "email" text,
  "source" varchar(32) NOT NULL DEFAULT 'app',
  "metadata" jsonb,
  "redeemed_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_beta_redemption_user_idx" ON "private_beta_redemption" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_beta_redemption_code_user_idx" ON "private_beta_redemption" ("code_id","user_id");
