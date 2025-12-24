-- Migration: Add advanced trading metrics fields to trade table
-- Generated: 2025-12-23

-- Add manipulation structure fields
ALTER TABLE "trade" ADD COLUMN "manipulation_high" numeric;
ALTER TABLE "trade" ADD COLUMN "manipulation_low" numeric;
ALTER TABLE "trade" ADD COLUMN "manipulation_pips" numeric;

-- Add entry price action fields (cached for performance)
ALTER TABLE "trade" ADD COLUMN "entry_peak_price" numeric;
ALTER TABLE "trade" ADD COLUMN "entry_peak_timestamp" timestamp;

-- Add post-exit price action fields (cached for performance)
ALTER TABLE "trade" ADD COLUMN "post_exit_peak_price" numeric;
ALTER TABLE "trade" ADD COLUMN "post_exit_peak_timestamp" timestamp;
ALTER TABLE "trade" ADD COLUMN "post_exit_sampling_duration" integer;

-- Add user configuration fields
ALTER TABLE "trade" ADD COLUMN "alpha_weighted_mpe" numeric DEFAULT '0.30';
ALTER TABLE "trade" ADD COLUMN "be_threshold_pips" numeric DEFAULT '0.5';
