ALTER TABLE "trading_account"
ADD COLUMN IF NOT EXISTS "prop_challenge_instance_id" text;

ALTER TABLE "trading_account"
ADD COLUMN IF NOT EXISTS "prop_is_current_challenge_stage" boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS "prop_challenge_instance" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "prop_firm_id" text NOT NULL,
  "prop_challenge_rule_id" text NOT NULL,
  "current_phase" integer DEFAULT 1 NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "current_account_id" text REFERENCES "trading_account"("id") ON DELETE set null,
  "started_at" date,
  "last_stage_started_at" date,
  "passed_at" timestamp,
  "failed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "prop_challenge_stage_account" (
  "id" text PRIMARY KEY NOT NULL,
  "challenge_instance_id" text NOT NULL REFERENCES "prop_challenge_instance"("id") ON DELETE cascade,
  "account_id" text NOT NULL REFERENCES "trading_account"("id") ON DELETE cascade,
  "phase_order" integer NOT NULL,
  "phase_label" text,
  "stage_status" varchar(20) DEFAULT 'active' NOT NULL,
  "phase_started_at" date,
  "phase_completed_at" timestamp,
  "phase_failed_at" timestamp,
  "start_balance" numeric,
  "start_equity" numeric,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_prop_challenge_instance_user"
ON "prop_challenge_instance" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_prop_challenge_instance_user_status"
ON "prop_challenge_instance" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "idx_prop_challenge_instance_current_account"
ON "prop_challenge_instance" ("current_account_id");

CREATE INDEX IF NOT EXISTS "idx_prop_challenge_stage_account_challenge"
ON "prop_challenge_stage_account" ("challenge_instance_id");

CREATE INDEX IF NOT EXISTS "idx_prop_challenge_stage_account_account"
ON "prop_challenge_stage_account" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_prop_challenge_stage_account_phase"
ON "prop_challenge_stage_account" ("challenge_instance_id", "phase_order");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_prop_challenge_stage_account_unique"
ON "prop_challenge_stage_account" ("challenge_instance_id", "account_id", "phase_order");
