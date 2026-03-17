CREATE TABLE IF NOT EXISTS "symbol_mapping" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "canonical_symbol" varchar(64) NOT NULL,
  "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_symbol_mapping_user"
ON "symbol_mapping" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_symbol_mapping_user_canonical"
ON "symbol_mapping" ("user_id", "canonical_symbol");
