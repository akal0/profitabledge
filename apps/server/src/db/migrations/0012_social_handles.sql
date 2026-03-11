-- Migration 0012: Add social handles to user

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS twitter TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS discord TEXT;
