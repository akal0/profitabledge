ALTER TABLE "user" ADD COLUMN "notification_preferences" jsonb;--> statement-breakpoint

CREATE TABLE "notification" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "account_id" text REFERENCES "trading_account"("id") ON DELETE cascade,
  "type" varchar(32) NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "metadata" jsonb,
  "dedupe_key" text,
  "read_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "idx_notification_user_created" ON "notification" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_user_dedupe" ON "notification" ("user_id", "dedupe_key");
