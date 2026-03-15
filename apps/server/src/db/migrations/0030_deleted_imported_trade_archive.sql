CREATE TABLE IF NOT EXISTS "deleted_imported_trade" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "trading_account"("id") ON DELETE cascade,
  "original_trade_id" text,
  "ticket" varchar(100),
  "import_fingerprint" text NOT NULL,
  "import_source" varchar(32),
  "import_parser_id" varchar(128),
  "import_report_type" varchar(128),
  "trade_snapshot" jsonb,
  "deleted_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deleted_imported_trade_account_fingerprint_idx" ON "deleted_imported_trade" ("account_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deleted_imported_trade_account_ticket_idx" ON "deleted_imported_trade" ("account_id","ticket");
