CREATE TABLE IF NOT EXISTS "journal_share" (
  "id" TEXT PRIMARY KEY,
  "owner_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "share_token" VARCHAR(64) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "revoked_at" TIMESTAMP,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "last_viewed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_share_token_idx"
  ON "journal_share"("share_token");
CREATE INDEX IF NOT EXISTS "idx_journal_share_owner"
  ON "journal_share"("owner_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_journal_share_active"
  ON "journal_share"("owner_user_id", "is_active");

CREATE TABLE IF NOT EXISTS "journal_share_entry" (
  "id" TEXT PRIMARY KEY,
  "share_id" TEXT NOT NULL REFERENCES "journal_share"("id") ON DELETE CASCADE,
  "journal_entry_id" TEXT NOT NULL REFERENCES "journal_entry"("id") ON DELETE CASCADE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_share_entry_unique_idx"
  ON "journal_share_entry"("share_id", "journal_entry_id");
CREATE INDEX IF NOT EXISTS "idx_journal_share_entry_share"
  ON "journal_share_entry"("share_id", "sort_order");
CREATE INDEX IF NOT EXISTS "idx_journal_share_entry_entry"
  ON "journal_share_entry"("journal_entry_id");

CREATE TABLE IF NOT EXISTS "journal_share_invite" (
  "id" TEXT PRIMARY KEY,
  "share_id" TEXT NOT NULL REFERENCES "journal_share"("id") ON DELETE CASCADE,
  "invited_by_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "invited_email" TEXT NOT NULL,
  "invited_email_normalized" TEXT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "claimed_viewer_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "claimed_at" TIMESTAMP,
  "revoked_at" TIMESTAMP,
  "expires_at" TIMESTAMP,
  "last_sent_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_share_invite_share_email_idx"
  ON "journal_share_invite"("share_id", "invited_email_normalized");
CREATE INDEX IF NOT EXISTS "idx_journal_share_invite_share"
  ON "journal_share_invite"("share_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_journal_share_invite_email"
  ON "journal_share_invite"("invited_email_normalized", "status");

CREATE TABLE IF NOT EXISTS "journal_share_viewer" (
  "id" TEXT PRIMARY KEY,
  "share_id" TEXT NOT NULL REFERENCES "journal_share"("id") ON DELETE CASCADE,
  "viewer_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "approved_by_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "source" VARCHAR(16) NOT NULL DEFAULT 'manual',
  "status" VARCHAR(16) NOT NULL DEFAULT 'approved',
  "approved_at" TIMESTAMP NOT NULL DEFAULT now(),
  "revoked_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_share_viewer_share_user_idx"
  ON "journal_share_viewer"("share_id", "viewer_user_id");
CREATE INDEX IF NOT EXISTS "idx_journal_share_viewer_share"
  ON "journal_share_viewer"("share_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_journal_share_viewer_user"
  ON "journal_share_viewer"("viewer_user_id", "status");

CREATE TABLE IF NOT EXISTS "journal_share_access_request" (
  "id" TEXT PRIMARY KEY,
  "share_id" TEXT NOT NULL REFERENCES "journal_share"("id") ON DELETE CASCADE,
  "requester_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "requester_email_snapshot" TEXT,
  "requester_name_snapshot" TEXT,
  "message" TEXT,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "decided_by_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "decided_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_share_access_request_share_user_idx"
  ON "journal_share_access_request"("share_id", "requester_user_id");
CREATE INDEX IF NOT EXISTS "idx_journal_share_access_request_share"
  ON "journal_share_access_request"("share_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_journal_share_access_request_user"
  ON "journal_share_access_request"("requester_user_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_journal_share_updated_at'
  ) THEN
    CREATE TRIGGER update_journal_share_updated_at
    BEFORE UPDATE ON "journal_share"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_journal_share_invite_updated_at'
  ) THEN
    CREATE TRIGGER update_journal_share_invite_updated_at
    BEFORE UPDATE ON "journal_share_invite"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_journal_share_viewer_updated_at'
  ) THEN
    CREATE TRIGGER update_journal_share_viewer_updated_at
    BEFORE UPDATE ON "journal_share_viewer"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_journal_share_access_request_updated_at'
  ) THEN
    CREATE TRIGGER update_journal_share_access_request_updated_at
    BEFORE UPDATE ON "journal_share_access_request"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
