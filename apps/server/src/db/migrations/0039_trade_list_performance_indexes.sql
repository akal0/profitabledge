CREATE INDEX IF NOT EXISTS "idx_trade_account_created_at"
  ON "trade" ("account_id", "created_at", "id");

CREATE INDEX IF NOT EXISTS "idx_trade_account_symbol"
  ON "trade" ("account_id", "symbol");
