ALTER TABLE "edge_missed_trade"
  ADD COLUMN IF NOT EXISTS "volume" numeric,
  ADD COLUMN IF NOT EXISTS "open_price" numeric,
  ADD COLUMN IF NOT EXISTS "close_price" numeric,
  ADD COLUMN IF NOT EXISTS "model_tag" text,
  ADD COLUMN IF NOT EXISTS "custom_tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "close_time" timestamp,
  ADD COLUMN IF NOT EXISTS "sl" numeric,
  ADD COLUMN IF NOT EXISTS "tp" numeric,
  ADD COLUMN IF NOT EXISTS "estimated_profit" numeric,
  ADD COLUMN IF NOT EXISTS "commissions" numeric,
  ADD COLUMN IF NOT EXISTS "swap" numeric;
