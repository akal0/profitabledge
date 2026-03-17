ALTER TABLE "trading_account"
ADD COLUMN IF NOT EXISTS "breakeven_threshold_pips" numeric DEFAULT '0.5';
