ALTER TABLE "affiliate_withdrawal_request"
ADD COLUMN IF NOT EXISTS "metadata" jsonb;
