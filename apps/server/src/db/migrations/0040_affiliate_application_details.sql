ALTER TABLE "affiliate_application"
ADD COLUMN IF NOT EXISTS "details" jsonb;
