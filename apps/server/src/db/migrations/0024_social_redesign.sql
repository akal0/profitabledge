-- Social Redesign: Truth Over Theater
-- This migration removes theater-oriented features and adds execution-focused social

-- Drop theater-oriented tables
DROP TABLE IF EXISTS "shared_trade" CASCADE;
DROP TABLE IF EXISTS "trade_idea" CASCADE;
DROP TABLE IF EXISTS "comment" CASCADE;
DROP TABLE IF EXISTS "like" CASCADE;
DROP TABLE IF EXISTS "mentorship" CASCADE;

-- Rename connection to account_follow (follow accounts, not people)
ALTER TABLE IF EXISTS "connection" RENAME TO "account_follow_old";

-- Account Following (follow accounts, not people)
CREATE TABLE IF NOT EXISTS "account_follow" (
  "id" TEXT PRIMARY KEY,
  "follower_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "followed_account_id" TEXT NOT NULL REFERENCES "trading_account"("id") ON DELETE CASCADE,
  "followed_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "notification_preferences" JSONB DEFAULT '{"newTrades": true, "milestones": true, "insights": true}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_follow_unique"
  ON "account_follow"("follower_user_id", "followed_account_id");
CREATE INDEX IF NOT EXISTS "idx_account_follow_follower"
  ON "account_follow"("follower_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_account_follow_account"
  ON "account_follow"("followed_account_id", "created_at" DESC);

-- Feed Events (auto-generated from verified trades)
CREATE TABLE IF NOT EXISTS "feed_event" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL REFERENCES "trading_account"("id") ON DELETE CASCADE,
  "event_type" VARCHAR(30) NOT NULL,
  "trade_id" TEXT REFERENCES "trade"("id") ON DELETE CASCADE,
  "event_data" JSONB NOT NULL,
  "caption" TEXT, -- Optional, max 60 chars, cannot contain emojis
  "is_visible" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_feed_event_account"
  ON "feed_event"("account_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_feed_event_type"
  ON "feed_event"("event_type", "created_at" DESC) WHERE "is_visible" = true;
CREATE INDEX IF NOT EXISTS "idx_feed_event_trade"
  ON "feed_event"("trade_id");

-- Trade Annotations (timestamped, immutable insights)
CREATE TABLE IF NOT EXISTS "trade_annotation" (
  "id" TEXT PRIMARY KEY,
  "trade_id" TEXT NOT NULL REFERENCES "trade"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL, -- Max 200 chars
  "annotation_type" VARCHAR(30) NOT NULL, -- execution_note, emotion_note, rule_note, learning_note
  "is_public" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "editable_until" TIMESTAMP NOT NULL, -- 5 min grace period
  "edited_at" TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_trade_annotation_unique"
  ON "trade_annotation"("trade_id");
CREATE INDEX IF NOT EXISTS "idx_trade_annotation_user"
  ON "trade_annotation"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_trade_annotation_public"
  ON "trade_annotation"("is_public", "created_at" DESC) WHERE "is_public" = true;

-- Pattern Follows (follow execution patterns, not people)
CREATE TABLE IF NOT EXISTS "pattern_follow" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL, -- User-defined name
  "pattern_config" JSONB NOT NULL,
  "match_count" INTEGER DEFAULT 0, -- Number of accounts matching pattern
  "last_matched_at" TIMESTAMP,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_pattern_follow_user"
  ON "pattern_follow"("user_id", "is_active", "created_at" DESC);

-- Pattern Matches (cached results)
CREATE TABLE IF NOT EXISTS "pattern_match" (
  "id" TEXT PRIMARY KEY,
  "pattern_follow_id" TEXT NOT NULL REFERENCES "pattern_follow"("id") ON DELETE CASCADE,
  "account_id" TEXT NOT NULL REFERENCES "trading_account"("id") ON DELETE CASCADE,
  "match_score" NUMERIC, -- How well it matches (0-1)
  "metrics_snapshot" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_pattern_match_pattern"
  ON "pattern_match"("pattern_follow_id", "match_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_pattern_match_account"
  ON "pattern_match"("account_id");

-- Mirror Comparisons (private execution comparisons)
CREATE TABLE IF NOT EXISTS "mirror_comparison" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "my_account_id" TEXT NOT NULL REFERENCES "trading_account"("id") ON DELETE CASCADE,
  "their_account_id" TEXT NOT NULL REFERENCES "trading_account"("id") ON DELETE CASCADE,
  "comparison_data" JSONB NOT NULL,
  "insights" JSONB, -- AI-generated insights
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_mirror_comparison_user"
  ON "mirror_comparison"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_mirror_comparison_my_account"
  ON "mirror_comparison"("my_account_id");

-- Redesign Leaderboard Entry (focus on quality metrics, not raw PnL)
DROP TABLE IF EXISTS "leaderboard_entry";

CREATE TABLE "leaderboard_entry" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL REFERENCES "trading_account"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,

  -- Time period
  "period" VARCHAR(20) NOT NULL, -- 30d, 90d, all_time
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,

  -- Category
  "category" VARCHAR(30) NOT NULL, -- consistency, execution, discipline, risk

  -- Metrics (category-specific)
  "metric_values" JSONB NOT NULL,

  -- Ranking (percentile-based, not #1/#2/#3)
  "percentile" INTEGER, -- 1-100
  "percentile_band" VARCHAR(20), -- "Top 10%", "Top 25%", "Top 50%"

  -- Sample requirements
  "total_trades" INTEGER NOT NULL,
  "sample_valid" BOOLEAN DEFAULT true,
  "minimum_trades_required" INTEGER DEFAULT 100,

  -- Filters (for filtered leaderboards)
  "prop_firm_id" TEXT,
  "session_tag" TEXT,
  "symbol" VARCHAR(64),

  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_leaderboard_unique"
  ON "leaderboard_entry"("account_id", "period", "period_start", "category");
CREATE INDEX IF NOT EXISTS "idx_leaderboard_period_category"
  ON "leaderboard_entry"("period", "category", "percentile" ASC, "updated_at" DESC)
  WHERE "sample_valid" = true;
CREATE INDEX IF NOT EXISTS "idx_leaderboard_user"
  ON "leaderboard_entry"("user_id", "period", "category");

-- Add verification tracking to trading accounts
ALTER TABLE "trading_account" ADD COLUMN IF NOT EXISTS "verification_level" VARCHAR(20) DEFAULT 'unverified';
-- unverified, ea_synced, api_verified, prop_verified

ALTER TABLE "trading_account" ADD COLUMN IF NOT EXISTS "social_opt_in" BOOLEAN DEFAULT false;
ALTER TABLE "trading_account" ADD COLUMN IF NOT EXISTS "social_visible_since" TIMESTAMP;
ALTER TABLE "trading_account" ADD COLUMN IF NOT EXISTS "follower_count" INTEGER DEFAULT 0;
ALTER TABLE "trading_account" ADD COLUMN IF NOT EXISTS "feed_event_count" INTEGER DEFAULT 0;

-- Update user table social fields
ALTER TABLE "user" DROP COLUMN IF EXISTS "follower_count";
ALTER TABLE "user" DROP COLUMN IF EXISTS "following_count";
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accounts_following_count" INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pattern_follows_count" INTEGER DEFAULT 0;

-- Quiet reputation metrics (replaces follower counts)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "verified_since" TIMESTAMP;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "total_verified_trades" INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "metrics_stable" BOOLEAN DEFAULT false; -- 90+ days, 100+ trades
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "avg_protocol_rate" NUMERIC; -- Across all accounts

-- Create function to update leaderboard on trade close
CREATE OR REPLACE FUNCTION update_leaderboard_on_trade_close()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be implemented as a background job
  -- Just track that a leaderboard update is needed
  PERFORM pg_notify('leaderboard_update', NEW.account_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trade close
DROP TRIGGER IF EXISTS trigger_leaderboard_update ON "trade";
CREATE TRIGGER trigger_leaderboard_update
  AFTER INSERT OR UPDATE ON "trade"
  FOR EACH ROW
  WHEN (NEW.close_time IS NOT NULL AND OLD.close_time IS NULL)
  EXECUTE FUNCTION update_leaderboard_on_trade_close();

-- Create function to generate feed events
CREATE OR REPLACE FUNCTION generate_feed_event_on_trade_close()
RETURNS TRIGGER AS $$
DECLARE
  account_social_opt_in BOOLEAN;
  account_verification_level VARCHAR(20);
BEGIN
  -- Check if account has social opt-in and is verified
  SELECT social_opt_in, verification_level INTO account_social_opt_in, account_verification_level
  FROM trading_account
  WHERE id = NEW.account_id;

  -- Only generate feed events for verified, opted-in accounts
  IF account_social_opt_in = true AND account_verification_level != 'unverified' THEN
    -- This will be implemented in application code for complex logic
    -- Just notify that a feed event should be generated
    PERFORM pg_notify('feed_event_generate', json_build_object(
      'trade_id', NEW.id,
      'account_id', NEW.account_id
    )::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for feed event generation
DROP TRIGGER IF EXISTS trigger_feed_event_generate ON "trade";
CREATE TRIGGER trigger_feed_event_generate
  AFTER INSERT OR UPDATE ON "trade"
  FOR EACH ROW
  WHEN (NEW.close_time IS NOT NULL AND OLD.close_time IS NULL)
  EXECUTE FUNCTION generate_feed_event_on_trade_close();

-- Cleanup old data (if exists)
DROP TABLE IF EXISTS "achievement" CASCADE;
DROP TABLE IF EXISTS "profile_view" CASCADE;

-- Keep activity table but simplify it
DROP TABLE IF EXISTS "activity";
CREATE TABLE IF NOT EXISTS "activity" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "activity_type" VARCHAR(30) NOT NULL,
  "content_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_activity_user"
  ON "activity"("user_id", "created_at" DESC);

-- Keep bookmark (private feature, not social)
-- Already exists from previous migration

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leaderboard_entry_updated_at') THEN
        CREATE TRIGGER update_leaderboard_entry_updated_at
          BEFORE UPDATE ON "leaderboard_entry"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pattern_follow_updated_at') THEN
        CREATE TRIGGER update_pattern_follow_updated_at
          BEFORE UPDATE ON "pattern_follow"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pattern_match_updated_at') THEN
        CREATE TRIGGER update_pattern_match_updated_at
          BEFORE UPDATE ON "pattern_match"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
