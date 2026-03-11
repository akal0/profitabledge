-- Migration 0013: EA execution metrics

ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_spread_pips numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS exit_spread_pips numeric;
