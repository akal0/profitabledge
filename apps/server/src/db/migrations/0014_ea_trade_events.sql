-- Migration 0014: EA trade execution/event metrics

ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_slippage_pips numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS exit_slippage_pips numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS sl_mod_count integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS tp_mod_count integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS partial_close_count integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS exit_deal_count integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS exit_volume numeric;
