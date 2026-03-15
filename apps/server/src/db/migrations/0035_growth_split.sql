ALTER TABLE "affiliate_profile"
  ADD COLUMN IF NOT EXISTS "display_name" text,
  ADD COLUMN IF NOT EXISTS "approved_at" timestamp,
  ADD COLUMN IF NOT EXISTS "approved_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "referral_profile" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "code" varchar(64) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_profile_user_idx" ON "referral_profile" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_profile_code_idx" ON "referral_profile" ("code");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "referral_conversion" (
  "id" text PRIMARY KEY NOT NULL,
  "referral_profile_id" text NOT NULL REFERENCES "referral_profile"("id") ON DELETE cascade,
  "referrer_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referred_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referral_code" varchar(64) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'signed_up',
  "paid_order_id" varchar(120),
  "paid_subscription_id" varchar(120),
  "paid_at" timestamp,
  "source" varchar(32) NOT NULL DEFAULT 'app',
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_conversion_referred_user_idx" ON "referral_conversion" ("referred_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_conversion_referrer_status_idx" ON "referral_conversion" ("referrer_user_id","status","created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "referral_reward_grant" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "reward_type" varchar(40) NOT NULL,
  "sequence_number" integer NOT NULL,
  "conversion_count" integer NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'granted',
  "edge_credits" integer,
  "polar_discount_id" varchar(120),
  "polar_discount_code" varchar(128),
  "target_plan_key" varchar(40),
  "override_starts_at" timestamp,
  "override_ends_at" timestamp,
  "metadata" jsonb,
  "granted_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_reward_grant_user_reward_idx" ON "referral_reward_grant" ("user_id","reward_type","sequence_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_reward_grant_user_status_idx" ON "referral_reward_grant" ("user_id","status","granted_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_application" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "status" varchar(24) NOT NULL DEFAULT 'pending',
  "message" text,
  "admin_notes" text,
  "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "reviewed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_application_user_idx" ON "affiliate_application" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_application_status_idx" ON "affiliate_application" ("status","created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_group" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_profile_id" text NOT NULL REFERENCES "affiliate_profile"("id") ON DELETE cascade,
  "owner_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" varchar(80) NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_group_profile_idx" ON "affiliate_group" ("affiliate_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_group_slug_idx" ON "affiliate_group" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_group_owner_idx" ON "affiliate_group" ("owner_user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_group_member" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_group_id" text NOT NULL REFERENCES "affiliate_group"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "source" varchar(32) NOT NULL DEFAULT 'open_link',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_group_member_user_idx" ON "affiliate_group_member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_group_member_group_user_idx" ON "affiliate_group_member" ("affiliate_group_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_group_member_group_idx" ON "affiliate_group_member" ("affiliate_group_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_attribution" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_profile_id" text NOT NULL REFERENCES "affiliate_profile"("id") ON DELETE cascade,
  "affiliate_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referred_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "affiliate_code" varchar(64) NOT NULL,
  "affiliate_group_id" text REFERENCES "affiliate_group"("id") ON DELETE set null,
  "status" varchar(24) NOT NULL DEFAULT 'signed_up',
  "first_paid_at" timestamp,
  "last_paid_at" timestamp,
  "converted_subscription_id" varchar(120),
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_attribution_referred_user_idx" ON "affiliate_attribution" ("referred_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_attribution_affiliate_status_idx" ON "affiliate_attribution" ("affiliate_user_id","status","created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_commission_event" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_attribution_id" text NOT NULL REFERENCES "affiliate_attribution"("id") ON DELETE cascade,
  "affiliate_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referred_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "polar_order_id" varchar(120) NOT NULL,
  "polar_subscription_id" varchar(120),
  "order_amount" integer,
  "commission_bps" integer NOT NULL DEFAULT 2000,
  "commission_amount" integer NOT NULL DEFAULT 0,
  "currency" varchar(10),
  "occurred_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_commission_event_order_idx" ON "affiliate_commission_event" ("polar_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_commission_event_affiliate_idx" ON "affiliate_commission_event" ("affiliate_user_id","occurred_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "private_beta_waitlist" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'pending',
  "source" varchar(32) NOT NULL DEFAULT 'root',
  "notes" text,
  "invited_code_id" text REFERENCES "private_beta_code"("id") ON DELETE set null,
  "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "reviewed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_beta_waitlist_email_idx" ON "private_beta_waitlist" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_beta_waitlist_status_idx" ON "private_beta_waitlist" ("status","created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_entitlement_override" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "source_type" varchar(32) NOT NULL,
  "source_reward_grant_id" text REFERENCES "referral_reward_grant"("id") ON DELETE cascade,
  "plan_key" varchar(40) NOT NULL,
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_entitlement_override_reward_idx" ON "billing_entitlement_override" ("source_reward_grant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_entitlement_override_user_period_idx" ON "billing_entitlement_override" ("user_id","starts_at","ends_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "edge_credit_grant" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referral_reward_grant_id" text REFERENCES "referral_reward_grant"("id") ON DELETE cascade,
  "source" varchar(32) NOT NULL DEFAULT 'referral',
  "amount_credits" integer NOT NULL,
  "remaining_credits" integer NOT NULL,
  "metadata" jsonb,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "edge_credit_grant_reward_idx" ON "edge_credit_grant" ("referral_reward_grant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edge_credit_grant_user_created_idx" ON "edge_credit_grant" ("user_id","created_at");--> statement-breakpoint

INSERT INTO "referral_profile" (
  "id",
  "user_id",
  "code",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "user_id",
  "code",
  true,
  "created_at",
  "updated_at"
FROM "affiliate_profile"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "referral_conversion" (
  "id",
  "referral_profile_id",
  "referrer_user_id",
  "referred_user_id",
  "referral_code",
  "status",
  "paid_order_id",
  "paid_subscription_id",
  "paid_at",
  "source",
  "metadata",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "affiliate_profile_id",
  "referrer_user_id",
  "referred_user_id",
  "referral_code",
  CASE
    WHEN "status" = 'converted' THEN 'paid'
    ELSE "status"
  END,
  "converted_order_id",
  "converted_subscription_id",
  "converted_at",
  'legacy',
  "metadata",
  "created_at",
  "updated_at"
FROM "affiliate_referral"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

UPDATE "affiliate_profile"
SET
  "is_active" = false,
  "display_name" = COALESCE("display_name", "user"."name"),
  "approved_at" = NULL,
  "approved_by_user_id" = NULL,
  "updated_at" = now()
FROM "user"
WHERE "affiliate_profile"."user_id" = "user"."id";--> statement-breakpoint
