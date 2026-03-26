CREATE TABLE IF NOT EXISTS "push_subscription" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "endpoint" text NOT NULL,
  "p256dh_key" text NOT NULL,
  "auth_key" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "last_success_at" timestamp,
  "last_failure_at" timestamp,
  "failure_reason" text
);

CREATE INDEX IF NOT EXISTS "idx_push_subscription_user_created"
  ON "push_subscription" ("user_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscription_endpoint_unique"
  ON "push_subscription" ("endpoint");
