ALTER TABLE "edge"
ADD COLUMN IF NOT EXISTS "public_stats_visible" boolean NOT NULL DEFAULT true;
