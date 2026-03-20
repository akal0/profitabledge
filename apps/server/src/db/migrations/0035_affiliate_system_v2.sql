CREATE TABLE IF NOT EXISTS "affiliate_offer" (
  "id" TEXT PRIMARY KEY,
  "affiliate_profile_id" TEXT NOT NULL REFERENCES "affiliate_profile"("id") ON DELETE CASCADE,
  "affiliate_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "code" VARCHAR(64) NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "polar_discount_id" VARCHAR(120),
  "discount_type" VARCHAR(24) NOT NULL DEFAULT 'percentage',
  "discount_basis_points" INTEGER NOT NULL DEFAULT 1000,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_by_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_offer_code_idx"
  ON "affiliate_offer"("code");
CREATE INDEX IF NOT EXISTS "affiliate_offer_profile_idx"
  ON "affiliate_offer"("affiliate_profile_id", "is_active", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_offer_affiliate_default_idx"
  ON "affiliate_offer"("affiliate_user_id", "is_default");

CREATE TABLE IF NOT EXISTS "affiliate_tracking_link" (
  "id" TEXT PRIMARY KEY,
  "affiliate_profile_id" TEXT NOT NULL REFERENCES "affiliate_profile"("id") ON DELETE CASCADE,
  "affiliate_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "affiliate_offer_id" TEXT REFERENCES "affiliate_offer"("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "destination_path" TEXT NOT NULL DEFAULT '/sign-up',
  "affiliate_group_slug" VARCHAR(80),
  "utm_source" TEXT,
  "utm_medium" TEXT,
  "utm_campaign" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_tracking_link_affiliate_slug_idx"
  ON "affiliate_tracking_link"("affiliate_profile_id", "slug");
CREATE INDEX IF NOT EXISTS "affiliate_tracking_link_affiliate_default_idx"
  ON "affiliate_tracking_link"("affiliate_user_id", "is_default");
CREATE INDEX IF NOT EXISTS "affiliate_tracking_link_offer_idx"
  ON "affiliate_tracking_link"("affiliate_offer_id");

CREATE TABLE IF NOT EXISTS "affiliate_touch_event" (
  "id" TEXT PRIMARY KEY,
  "visitor_token" VARCHAR(120) NOT NULL,
  "touch_type" VARCHAR(24) NOT NULL,
  "affiliate_profile_id" TEXT REFERENCES "affiliate_profile"("id") ON DELETE SET NULL,
  "affiliate_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "referral_profile_id" TEXT REFERENCES "referral_profile"("id") ON DELETE SET NULL,
  "affiliate_offer_id" TEXT REFERENCES "affiliate_offer"("id") ON DELETE SET NULL,
  "affiliate_tracking_link_id" TEXT REFERENCES "affiliate_tracking_link"("id") ON DELETE SET NULL,
  "affiliate_code" VARCHAR(64),
  "referral_code" VARCHAR(64),
  "affiliate_group_slug" VARCHAR(80),
  "source_path" TEXT,
  "referrer_url" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "affiliate_touch_event_visitor_idx"
  ON "affiliate_touch_event"("visitor_token", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_touch_event_affiliate_idx"
  ON "affiliate_touch_event"("affiliate_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_touch_event_offer_idx"
  ON "affiliate_touch_event"("affiliate_offer_id", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_touch_event_link_idx"
  ON "affiliate_touch_event"("affiliate_tracking_link_id", "created_at");

CREATE TABLE IF NOT EXISTS "affiliate_pending_attribution" (
  "id" TEXT PRIMARY KEY,
  "visitor_token" VARCHAR(120) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "touch_type" VARCHAR(24) NOT NULL,
  "affiliate_profile_id" TEXT REFERENCES "affiliate_profile"("id") ON DELETE SET NULL,
  "affiliate_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "referral_profile_id" TEXT REFERENCES "referral_profile"("id") ON DELETE SET NULL,
  "affiliate_offer_id" TEXT REFERENCES "affiliate_offer"("id") ON DELETE SET NULL,
  "affiliate_tracking_link_id" TEXT REFERENCES "affiliate_tracking_link"("id") ON DELETE SET NULL,
  "affiliate_code" VARCHAR(64),
  "referral_code" VARCHAR(64),
  "affiliate_group_slug" VARCHAR(80),
  "first_touched_at" TIMESTAMP NOT NULL DEFAULT now(),
  "last_touched_at" TIMESTAMP NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP NOT NULL,
  "claimed_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "claimed_at" TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_pending_attribution_visitor_idx"
  ON "affiliate_pending_attribution"("visitor_token");
CREATE INDEX IF NOT EXISTS "affiliate_pending_attribution_status_expiry_idx"
  ON "affiliate_pending_attribution"("status", "expires_at");
CREATE INDEX IF NOT EXISTS "affiliate_pending_attribution_affiliate_idx"
  ON "affiliate_pending_attribution"("affiliate_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "affiliate_provider_account" (
  "id" TEXT PRIMARY KEY,
  "affiliate_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "provider" VARCHAR(32) NOT NULL DEFAULT 'stripe_connect',
  "provider_account_id" VARCHAR(120) NOT NULL,
  "country" VARCHAR(8),
  "currency" VARCHAR(8),
  "email" TEXT,
  "onboarding_status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "details_submitted" BOOLEAN NOT NULL DEFAULT false,
  "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
  "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "disconnected_at" TIMESTAMP,
  "last_synced_at" TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_provider_account_affiliate_idx"
  ON "affiliate_provider_account"("affiliate_user_id", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_provider_account_provider_account_idx"
  ON "affiliate_provider_account"("provider_account_id");

CREATE TABLE IF NOT EXISTS "affiliate_withdrawal_request" (
  "id" TEXT PRIMARY KEY,
  "affiliate_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "destination_type" VARCHAR(32) NOT NULL,
  "provider_account_id" TEXT REFERENCES "affiliate_provider_account"("id") ON DELETE SET NULL,
  "payment_method_id" TEXT REFERENCES "affiliate_payment_method"("id") ON DELETE SET NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "external_reference" TEXT,
  "provider_transfer_id" VARCHAR(120),
  "provider_payout_id" VARCHAR(120),
  "notes" TEXT,
  "requested_at" TIMESTAMP NOT NULL DEFAULT now(),
  "approved_at" TIMESTAMP,
  "rejected_at" TIMESTAMP,
  "cancelled_at" TIMESTAMP,
  "paid_at" TIMESTAMP,
  "reviewed_by_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "affiliate_withdrawal_request_affiliate_idx"
  ON "affiliate_withdrawal_request"("affiliate_user_id", "requested_at");
CREATE INDEX IF NOT EXISTS "affiliate_withdrawal_request_status_idx"
  ON "affiliate_withdrawal_request"("status", "requested_at");
CREATE INDEX IF NOT EXISTS "affiliate_withdrawal_request_provider_idx"
  ON "affiliate_withdrawal_request"("provider_account_id");

ALTER TABLE "affiliate_attribution"
  ADD COLUMN IF NOT EXISTS "affiliate_offer_id" TEXT REFERENCES "affiliate_offer"("id") ON DELETE SET NULL;
ALTER TABLE "affiliate_attribution"
  ADD COLUMN IF NOT EXISTS "affiliate_tracking_link_id" TEXT REFERENCES "affiliate_tracking_link"("id") ON DELETE SET NULL;

ALTER TABLE "affiliate_payout"
  ADD COLUMN IF NOT EXISTS "withdrawal_request_id" TEXT REFERENCES "affiliate_withdrawal_request"("id") ON DELETE SET NULL;
ALTER TABLE "affiliate_payout"
  ADD COLUMN IF NOT EXISTS "destination_type" VARCHAR(32) NOT NULL DEFAULT 'manual';
ALTER TABLE "affiliate_payout"
  ADD COLUMN IF NOT EXISTS "provider_account_id" TEXT REFERENCES "affiliate_provider_account"("id") ON DELETE SET NULL;
ALTER TABLE "affiliate_payout"
  ADD COLUMN IF NOT EXISTS "stripe_transfer_id" VARCHAR(120);
ALTER TABLE "affiliate_payout"
  ADD COLUMN IF NOT EXISTS "stripe_payout_id" VARCHAR(120);
