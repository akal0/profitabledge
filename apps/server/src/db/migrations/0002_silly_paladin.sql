-- Add table_preferences to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "table_preferences" jsonb;

-- Create historical_prices table
CREATE TABLE IF NOT EXISTS "historical_prices" (
  "id" text PRIMARY KEY,
  "symbol" varchar(64) NOT NULL,
  "timeframe" varchar(16) NOT NULL,
  "time" timestamp NOT NULL,
  "open" numeric NOT NULL,
  "high" numeric NOT NULL,
  "low" numeric NOT NULL,
  "close" numeric NOT NULL
);
CREATE INDEX IF NOT EXISTS "historical_prices_symbol_time_idx"
  ON "historical_prices" ("symbol", "time");
ALTER TABLE "trading_account" ADD COLUMN "initial_balance" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "initial_currency" varchar(8);
