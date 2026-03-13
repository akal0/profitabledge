ALTER TABLE "prop_firm"
ADD COLUMN IF NOT EXISTS "created_by_user_id" text REFERENCES "user"("id") ON DELETE cascade;

ALTER TABLE "prop_challenge_rule"
ADD COLUMN IF NOT EXISTS "created_by_user_id" text REFERENCES "user"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "idx_prop_firm_owner"
ON "prop_firm" ("created_by_user_id");

CREATE INDEX IF NOT EXISTS "idx_prop_challenge_rule_owner"
ON "prop_challenge_rule" ("created_by_user_id");
