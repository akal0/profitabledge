CREATE TABLE IF NOT EXISTS "trade_idea_share" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "journal_entry_id" text REFERENCES "journal_entry"("id") ON DELETE SET NULL,
  "share_token" varchar(32) NOT NULL,
  "symbol" text NOT NULL,
  "direction" varchar(10) NOT NULL,
  "entry_price" numeric,
  "stop_loss" numeric,
  "take_profit" numeric,
  "risk_reward" numeric,
  "title" text,
  "description" text,
  "trade_phase" varchar(20),
  "strategy_name" text,
  "timeframe" varchar(10),
  "session" varchar(30),
  "chart_image_url" text,
  "chart_image_width" integer,
  "chart_image_height" integer,
  "og_image_url" text,
  "og_image_generated_at" timestamp,
  "show_username" boolean NOT NULL DEFAULT true,
  "show_prices" boolean NOT NULL DEFAULT true,
  "show_rr" boolean NOT NULL DEFAULT true,
  "author_display_name" text,
  "author_username" text,
  "author_avatar_url" text,
  "author_banner_url" text,
  "author_profile_effects" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "view_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_idea_share_token_idx"
  ON "trade_idea_share"("share_token");

CREATE INDEX IF NOT EXISTS "idx_trade_idea_share_user"
  ON "trade_idea_share"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_trade_idea_share_active"
  ON "trade_idea_share"("is_active", "expires_at");

CREATE INDEX IF NOT EXISTS "idx_trade_idea_share_journal_entry"
  ON "trade_idea_share"("journal_entry_id", "created_at");
