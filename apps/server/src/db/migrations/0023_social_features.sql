-- Social Features Migration
-- Adds public profiles, trade sharing, leaderboards, connections, and premium verification

-- Add social fields to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_public_profile" BOOLEAN DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "profile_banner_url" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "trading_since" DATE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_premium" BOOLEAN DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "verification_badge_type" VARCHAR(20); -- 'premium' | 'funded' | 'mentor' | 'partner'
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "leaderboard_opt_in" BOOLEAN DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "leaderboard_display_name" TEXT; -- Anonymous or custom name
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "profile_views" INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "follower_count" INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "following_count" INTEGER DEFAULT 0;

-- Shared Trades (individual trade cards shared on social media)
CREATE TABLE IF NOT EXISTS "shared_trade" (
  "id" TEXT PRIMARY KEY,
  "share_id" TEXT NOT NULL UNIQUE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "trade_id" TEXT NOT NULL REFERENCES "trade"("id") ON DELETE CASCADE,
  "template_id" TEXT REFERENCES "pnl_card_template"("id") ON DELETE SET NULL,
  "config" JSONB NOT NULL, -- Card configuration snapshot
  "card_data" JSONB NOT NULL, -- Trade data snapshot
  "title" TEXT,
  "description" TEXT,
  "tags" TEXT[], -- e.g., ["forex", "gold", "scalping"]
  "is_public" BOOLEAN DEFAULT true,
  "is_featured" BOOLEAN DEFAULT false, -- Featured by platform
  "password" TEXT, -- Optional password protection
  "expires_at" TIMESTAMP,
  "view_count" INTEGER DEFAULT 0,
  "like_count" INTEGER DEFAULT 0,
  "comment_count" INTEGER DEFAULT 0,
  "share_count" INTEGER DEFAULT 0,
  "last_viewed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_shared_trade_user" ON "shared_trade"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_shared_trade_public" ON "shared_trade"("is_public", "created_at" DESC) WHERE "is_public" = true;
CREATE INDEX IF NOT EXISTS "idx_shared_trade_featured" ON "shared_trade"("is_featured", "like_count" DESC) WHERE "is_featured" = true;

-- Trade Ideas Feed (optional sharing of trades with commentary/analysis)
CREATE TABLE IF NOT EXISTS "trade_idea" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "trade_id" TEXT REFERENCES "trade"("id") ON DELETE SET NULL, -- Optional: can share without a closed trade
  "shared_trade_id" TEXT REFERENCES "shared_trade"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL, -- Markdown formatted analysis
  "symbol" VARCHAR(64) NOT NULL,
  "trade_type" VARCHAR(8), -- 'long' | 'short'
  "entry_price" NUMERIC,
  "stop_loss" NUMERIC,
  "take_profit" NUMERIC,
  "risk_reward" NUMERIC,
  "status" VARCHAR(20) DEFAULT 'active', -- 'active' | 'closed' | 'stopped' | 'hit_tp'
  "tags" TEXT[],
  "image_urls" TEXT[], -- Chart screenshots
  "is_published" BOOLEAN DEFAULT false,
  "is_premium_only" BOOLEAN DEFAULT false, -- Only visible to premium users
  "view_count" INTEGER DEFAULT 0,
  "like_count" INTEGER DEFAULT 0,
  "comment_count" INTEGER DEFAULT 0,
  "bookmark_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_trade_idea_user" ON "trade_idea"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_trade_idea_published" ON "trade_idea"("is_published", "created_at" DESC) WHERE "is_published" = true;
CREATE INDEX IF NOT EXISTS "idx_trade_idea_symbol" ON "trade_idea"("symbol", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_trade_idea_popular" ON "trade_idea"("like_count" DESC, "created_at" DESC) WHERE "is_published" = true;

-- Comments on shared content
CREATE TABLE IF NOT EXISTS "comment" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "parent_id" TEXT REFERENCES "comment"("id") ON DELETE CASCADE, -- For nested replies
  "content_type" VARCHAR(20) NOT NULL, -- 'shared_trade' | 'trade_idea'
  "content_id" TEXT NOT NULL, -- ID of the shared_trade or trade_idea
  "content" TEXT NOT NULL,
  "like_count" INTEGER DEFAULT 0,
  "is_edited" BOOLEAN DEFAULT false,
  "is_pinned" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_comment_content" ON "comment"("content_type", "content_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_comment_user" ON "comment"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_comment_parent" ON "comment"("parent_id", "created_at" DESC);

-- Likes/Reactions
CREATE TABLE IF NOT EXISTS "like" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "content_type" VARCHAR(20) NOT NULL, -- 'shared_trade' | 'trade_idea' | 'comment'
  "content_id" TEXT NOT NULL,
  "reaction_type" VARCHAR(20) DEFAULT 'like', -- 'like' | 'fire' | 'clap' | 'trophy'
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_like_unique" ON "like"("user_id", "content_type", "content_id");
CREATE INDEX IF NOT EXISTS "idx_like_content" ON "like"("content_type", "content_id", "created_at" DESC);

-- Bookmarks
CREATE TABLE IF NOT EXISTS "bookmark" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "content_type" VARCHAR(20) NOT NULL, -- 'shared_trade' | 'trade_idea'
  "content_id" TEXT NOT NULL,
  "folder" TEXT, -- Optional folder organization
  "notes" TEXT, -- Private notes
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_bookmark_unique" ON "bookmark"("user_id", "content_type", "content_id");
CREATE INDEX IF NOT EXISTS "idx_bookmark_user" ON "bookmark"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_bookmark_folder" ON "bookmark"("user_id", "folder", "created_at" DESC);

-- User Connections (Following/Followers)
CREATE TABLE IF NOT EXISTS "connection" (
  "id" TEXT PRIMARY KEY,
  "follower_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "following_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "connection_type" VARCHAR(20) DEFAULT 'follow', -- 'follow' | 'mentor' | 'student'
  "is_mutual" BOOLEAN DEFAULT false,
  "notes" TEXT, -- Private notes about connection
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_connection_unique" ON "connection"("follower_id", "following_id");
CREATE INDEX IF NOT EXISTS "idx_connection_follower" ON "connection"("follower_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_connection_following" ON "connection"("following_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_connection_mentor" ON "connection"("following_id", "connection_type") WHERE "connection_type" = 'mentor';

-- Leaderboard Entries (anonymous or named)
CREATE TABLE IF NOT EXISTS "leaderboard_entry" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "account_id" TEXT REFERENCES "trading_account"("id") ON DELETE CASCADE,
  "period" VARCHAR(20) NOT NULL, -- 'daily' | 'weekly' | 'monthly' | 'all_time'
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "display_name" TEXT NOT NULL, -- Can be anonymous
  "is_anonymous" BOOLEAN DEFAULT true,
  "rank" INTEGER,
  "category" VARCHAR(30) NOT NULL, -- 'profit' | 'win_rate' | 'consistency' | 'rr_capture'
  "metric_value" NUMERIC NOT NULL,
  "total_trades" INTEGER,
  "win_rate" NUMERIC,
  "profit_factor" NUMERIC,
  "total_profit" NUMERIC,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_leaderboard_period" ON "leaderboard_entry"("period", "period_start", "category", "rank");
CREATE INDEX IF NOT EXISTS "idx_leaderboard_user" ON "leaderboard_entry"("user_id", "period", "period_start");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_leaderboard_unique" ON "leaderboard_entry"("user_id", "account_id", "period", "period_start", "category");

-- Activity Feed (for showing follower activity)
CREATE TABLE IF NOT EXISTS "activity" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "activity_type" VARCHAR(30) NOT NULL, -- 'shared_trade' | 'trade_idea' | 'comment' | 'like' | 'follow' | 'achievement'
  "content_type" VARCHAR(20),
  "content_id" TEXT,
  "metadata" JSONB, -- Additional context
  "is_public" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_activity_user" ON "activity"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_public" ON "activity"("is_public", "created_at" DESC) WHERE "is_public" = true;

-- User Achievements/Badges
CREATE TABLE IF NOT EXISTS "achievement" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "achievement_type" VARCHAR(50) NOT NULL, -- 'first_win' | 'win_streak_10' | 'profit_1000' | 'funded_trader' | 'consistent_month'
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon_url" TEXT,
  "rarity" VARCHAR(20), -- 'common' | 'rare' | 'epic' | 'legendary'
  "is_displayed" BOOLEAN DEFAULT true, -- Show on profile
  "earned_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_achievement_user" ON "achievement"("user_id", "earned_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_achievement_unique" ON "achievement"("user_id", "achievement_type");

-- Profile Views (analytics)
CREATE TABLE IF NOT EXISTS "profile_view" (
  "id" TEXT PRIMARY KEY,
  "profile_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "viewer_user_id" TEXT REFERENCES "user"("id") ON DELETE CASCADE, -- NULL if anonymous
  "viewer_ip" TEXT,
  "viewer_country" VARCHAR(2),
  "referrer" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_profile_view_profile" ON "profile_view"("profile_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_profile_view_viewer" ON "profile_view"("viewer_user_id", "created_at" DESC);

-- Mentor/Student Relationships
CREATE TABLE IF NOT EXISTS "mentorship" (
  "id" TEXT PRIMARY KEY,
  "mentor_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "student_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'active' | 'completed' | 'cancelled'
  "start_date" DATE,
  "end_date" DATE,
  "goals" TEXT,
  "notes" TEXT,
  "meeting_frequency" VARCHAR(20), -- 'weekly' | 'biweekly' | 'monthly'
  "last_meeting_at" TIMESTAMP,
  "next_meeting_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_mentorship_unique" ON "mentorship"("mentor_id", "student_id");
CREATE INDEX IF NOT EXISTS "idx_mentorship_mentor" ON "mentorship"("mentor_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_mentorship_student" ON "mentorship"("student_id", "status", "created_at" DESC);

-- Create updated_at triggers for tables that need it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shared_trade_updated_at') THEN
        CREATE TRIGGER update_shared_trade_updated_at BEFORE UPDATE ON "shared_trade" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trade_idea_updated_at') THEN
        CREATE TRIGGER update_trade_idea_updated_at BEFORE UPDATE ON "trade_idea" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_comment_updated_at') THEN
        CREATE TRIGGER update_comment_updated_at BEFORE UPDATE ON "comment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leaderboard_entry_updated_at') THEN
        CREATE TRIGGER update_leaderboard_entry_updated_at BEFORE UPDATE ON "leaderboard_entry" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mentorship_updated_at') THEN
        CREATE TRIGGER update_mentorship_updated_at BEFORE UPDATE ON "mentorship" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
