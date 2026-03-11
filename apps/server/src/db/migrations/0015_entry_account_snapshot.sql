-- Migration 0015: Entry account snapshot

ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_balance numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_equity numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_margin numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_free_margin numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_margin_level numeric;
