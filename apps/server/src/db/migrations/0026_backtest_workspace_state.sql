ALTER TABLE "backtest_session"
ADD COLUMN IF NOT EXISTS "workspace_state" jsonb,
ADD COLUMN IF NOT EXISTS "simulation_config" jsonb,
ADD COLUMN IF NOT EXISTS "linked_rule_set_id" text REFERENCES "trading_rule_set"("id") ON DELETE SET NULL;

ALTER TABLE "backtest_trade"
ADD COLUMN IF NOT EXISTS "fees" numeric,
ADD COLUMN IF NOT EXISTS "commission" numeric,
ADD COLUMN IF NOT EXISTS "swap" numeric,
ADD COLUMN IF NOT EXISTS "entry_spread_pips" numeric,
ADD COLUMN IF NOT EXISTS "entry_slippage_pips" numeric,
ADD COLUMN IF NOT EXISTS "exit_slippage_pips" numeric,
ADD COLUMN IF NOT EXISTS "slippage_price" numeric;

CREATE INDEX IF NOT EXISTS "idx_backtest_session_rule_set"
ON "backtest_session"("linked_rule_set_id");
