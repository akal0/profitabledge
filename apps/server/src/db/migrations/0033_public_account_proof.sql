ALTER TABLE "trade"
ADD COLUMN IF NOT EXISTS "origin_type" varchar(24);
--> statement-breakpoint
ALTER TABLE "trade"
ADD COLUMN IF NOT EXISTS "origin_label" text;
--> statement-breakpoint
ALTER TABLE "trade"
ADD COLUMN IF NOT EXISTS "origin_captured_at" timestamp;
--> statement-breakpoint
UPDATE "trade"
SET
  "origin_type" = CASE
    WHEN COALESCE("broker_meta"->>'importParserId', '') <> '' OR COALESCE("ticket", '') LIKE 'import-%' THEN 'csv_import'
    WHEN COALESCE("use_broker_data", 0) = 1 THEN 'broker_sync'
    ELSE 'manual_entry'
  END,
  "origin_label" = CASE
    WHEN COALESCE("broker_meta"->>'importParserId', '') <> '' OR COALESCE("ticket", '') LIKE 'import-%' THEN 'CSV import'
    WHEN COALESCE("use_broker_data", 0) = 1 THEN 'Broker sync'
    ELSE 'Manual entry'
  END,
  "origin_captured_at" = COALESCE("origin_captured_at", "created_at", NOW())
WHERE
  "origin_type" IS NULL
  OR "origin_label" IS NULL
  OR "origin_captured_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_account_share" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "account_id" text NOT NULL REFERENCES "trading_account"("id") ON DELETE cascade,
  "public_account_slug" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "revoked_at" timestamp,
  "view_count" integer DEFAULT 0 NOT NULL,
  "last_viewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_account_share_account_idx"
ON "public_account_share" ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_account_share_active_idx"
ON "public_account_share" ("account_id", "is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "public_account_share_slug_idx"
ON "public_account_share" ("public_account_slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trade_trust_event" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "trading_account"("id") ON DELETE cascade,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "trade_id" text,
  "event_type" varchar(24) NOT NULL,
  "change_source" varchar(24) DEFAULT 'app' NOT NULL,
  "origin_type" varchar(24),
  "changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "before_data" jsonb,
  "after_data" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_trust_event_account_event_idx"
ON "trade_trust_event" ("account_id", "event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_trust_event_account_trade_idx"
ON "trade_trust_event" ("account_id", "trade_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_trust_event_created_idx"
ON "trade_trust_event" ("created_at");
