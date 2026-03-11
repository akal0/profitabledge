CREATE TABLE IF NOT EXISTS "report" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE CASCADE,
  "account_id" text REFERENCES "public"."trading_account"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "intent" text,
  "title" text,
  "summary" text,
  "payload" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_report_user" ON "report" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_report_account" ON "report" ("account_id", "created_at");
