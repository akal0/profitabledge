ALTER TABLE "affiliate_profile"
  ADD COLUMN IF NOT EXISTS "tier_key" VARCHAR(24) NOT NULL DEFAULT 'partner';

ALTER TABLE "affiliate_profile"
  ADD COLUMN IF NOT EXISTS "tier_mode" VARCHAR(24) NOT NULL DEFAULT 'automatic';

ALTER TABLE "affiliate_profile"
  ADD COLUMN IF NOT EXISTS "tier_assigned_at" TIMESTAMP;

ALTER TABLE "affiliate_profile"
  ADD COLUMN IF NOT EXISTS "tier_assigned_by_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL;

UPDATE "affiliate_profile"
SET
  "tier_key" = COALESCE("tier_key", 'partner'),
  "tier_mode" = COALESCE("tier_mode", 'automatic'),
  "tier_assigned_at" = COALESCE("tier_assigned_at", "approved_at", "created_at")
WHERE TRUE;
