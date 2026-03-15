CREATE TABLE IF NOT EXISTS "ai_credit_usage" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "account_id" text REFERENCES "trading_account"("id") ON DELETE set null,
  "credential_source" varchar(24) NOT NULL,
  "provider" varchar(32) NOT NULL,
  "model" varchar(80) NOT NULL,
  "feature_key" varchar(80) NOT NULL,
  "prompt_token_count" integer,
  "candidates_token_count" integer,
  "total_token_count" integer,
  "cached_content_token_count" integer,
  "estimated_prompt_tokens" integer,
  "estimated_max_output_tokens" integer,
  "estimated_cost_micros" integer,
  "charged_cost_micros" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_credit_usage_user_created_idx" ON "ai_credit_usage" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_credit_usage_cycle_spend_idx" ON "ai_credit_usage" ("user_id","credential_source","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_credit_usage_account_created_idx" ON "ai_credit_usage" ("account_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_credit_usage_feature_created_idx" ON "ai_credit_usage" ("feature_key","created_at");
