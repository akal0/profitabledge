CREATE TABLE IF NOT EXISTS "edge_version" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "edge_id" TEXT NOT NULL REFERENCES "edge"("id") ON DELETE CASCADE,
  "version_number" INTEGER NOT NULL,
  "created_by_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "change_type" VARCHAR(40) NOT NULL,
  "change_summary" TEXT,
  "changed_fields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "diff_summary" JSONB,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "edge_version_edge_version_idx"
  ON "edge_version"("edge_id", "version_number");

CREATE INDEX IF NOT EXISTS "idx_edge_version_edge_created"
  ON "edge_version"("edge_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_edge_version_actor"
  ON "edge_version"("created_by_user_id");
