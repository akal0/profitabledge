ALTER TABLE "trade"
ADD COLUMN IF NOT EXISTS "broker_meta" jsonb;

ALTER TABLE "open_trade"
ADD COLUMN IF NOT EXISTS "broker_meta" jsonb;
