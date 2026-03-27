ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "display_username" text,
  ADD COLUMN IF NOT EXISTS "role" text,
  ADD COLUMN IF NOT EXISTS "banned" boolean,
  ADD COLUMN IF NOT EXISTS "ban_reason" text,
  ADD COLUMN IF NOT EXISTS "ban_expires" timestamp,
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean,
  ADD COLUMN IF NOT EXISTS "last_login_method" text;

ALTER TABLE "user"
  ALTER COLUMN "role" SET DEFAULT 'user',
  ALTER COLUMN "banned" SET DEFAULT false,
  ALTER COLUMN "two_factor_enabled" SET DEFAULT false;

UPDATE "user"
SET
  "role" = COALESCE("role", 'user'),
  "banned" = COALESCE("banned", false),
  "two_factor_enabled" = COALESCE("two_factor_enabled", false),
  "display_username" = COALESCE("display_username", "username");

ALTER TABLE "session"
  ADD COLUMN IF NOT EXISTS "impersonated_by" text,
  ADD COLUMN IF NOT EXISTS "active_organization_id" text;

CREATE TABLE IF NOT EXISTS "two_factor" (
  "id" text PRIMARY KEY NOT NULL,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "two_factor_secret_idx"
  ON "two_factor" ("secret");

CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_user_idx"
  ON "two_factor" ("user_id");

CREATE TABLE IF NOT EXISTS "passkey" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "public_key" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "credential_id" text NOT NULL,
  "counter" integer NOT NULL,
  "device_type" text NOT NULL,
  "backed_up" boolean NOT NULL,
  "transports" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "aaguid" text
);

CREATE INDEX IF NOT EXISTS "passkey_user_idx"
  ON "passkey" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credential_idx"
  ON "passkey" ("credential_id");

CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_slug_idx"
  ON "organization" ("slug");

CREATE TABLE IF NOT EXISTS "member" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "role" text NOT NULL DEFAULT 'member',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_user_idx"
  ON "member" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "member_org_user_idx"
  ON "member" ("organization_id", "user_id");

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "role" text,
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "invitation_org_idx"
  ON "invitation" ("organization_id");

CREATE INDEX IF NOT EXISTS "invitation_email_idx"
  ON "invitation" ("email");
