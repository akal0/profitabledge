-- PnL Card Templates Table
CREATE TABLE IF NOT EXISTS "pnl_card_template" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "name" text NOT NULL,
  "description" text,
  "background_type" varchar(20) DEFAULT 'gradient' NOT NULL,
  "background_value" text NOT NULL,
  "background_image_url" text,
  "layout" jsonb NOT NULL,
  "is_public" boolean DEFAULT false,
  "is_system" boolean DEFAULT false,
  "usage_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Shared PnL Cards Table
CREATE TABLE IF NOT EXISTS "shared_pnl_card" (
  "id" text PRIMARY KEY NOT NULL,
  "share_id" text NOT NULL UNIQUE,
  "user_id" text NOT NULL,
  "trade_id" text NOT NULL,
  "template_id" text,
  "config" jsonb NOT NULL,
  "image_url" text,
  "card_data" jsonb NOT NULL,
  "is_public" boolean DEFAULT true,
  "expires_at" timestamp,
  "password" text,
  "view_count" integer DEFAULT 0,
  "last_viewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Foreign Keys
ALTER TABLE "pnl_card_template" ADD CONSTRAINT "pnl_card_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;
ALTER TABLE "shared_pnl_card" ADD CONSTRAINT "shared_pnl_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;
ALTER TABLE "shared_pnl_card" ADD CONSTRAINT "shared_pnl_card_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "trade"("id") ON DELETE cascade;
ALTER TABLE "shared_pnl_card" ADD CONSTRAINT "shared_pnl_card_template_id_pnl_card_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "pnl_card_template"("id") ON DELETE set null;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_pnl_card_template_user" ON "pnl_card_template" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_pnl_card_template_public" ON "pnl_card_template" ("is_public");
CREATE INDEX IF NOT EXISTS "idx_shared_pnl_card_user" ON "shared_pnl_card" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_shared_pnl_card_trade" ON "shared_pnl_card" ("trade_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_shared_pnl_card_share_id" ON "shared_pnl_card" ("share_id");
