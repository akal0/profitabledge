-- Migration 0016: EA behavior metrics

ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_deal_count integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_volume numeric;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS scale_in_count integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS scale_out_count integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS trailing_stop_detected boolean;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS entry_peak_duration_seconds integer;
ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS post_exit_peak_duration_seconds integer;
