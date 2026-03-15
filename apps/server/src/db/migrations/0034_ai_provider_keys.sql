CREATE TABLE IF NOT EXISTS "ai_provider_key" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "provider" varchar(32) NOT NULL,
  "display_name" text NOT NULL,
  "encrypted_api_key" text NOT NULL,
  "credential_iv" text NOT NULL,
  "key_prefix" varchar(32) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_validated_at" timestamp,
  "last_used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_key_user_provider_idx" ON "ai_provider_key" ("user_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_provider_key_user_created_idx" ON "ai_provider_key" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_provider_key_provider_active_idx" ON "ai_provider_key" ("provider","is_active");
