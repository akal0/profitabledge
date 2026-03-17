ALTER TABLE "trading_account"
ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "trade"
ADD COLUMN IF NOT EXISTS "custom_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trading_account_tags"
ON "trading_account"
USING gin ("tags");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_custom_tags"
ON "trade"
USING gin ("custom_tags");
