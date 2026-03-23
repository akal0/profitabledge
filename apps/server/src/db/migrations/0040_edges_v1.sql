CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "edge" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "source_edge_id" text,
  "name" varchar(120) NOT NULL,
  "normalized_name" varchar(160) NOT NULL,
  "description" text,
  "color" varchar(7) NOT NULL DEFAULT '#3B82F6',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "publication_mode" varchar(20) NOT NULL DEFAULT 'private',
  "is_featured" boolean NOT NULL DEFAULT false,
  "featured_at" timestamp,
  "featured_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_owner"
  ON "edge" ("owner_user_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "edge_owner_normalized_name_idx"
  ON "edge" ("owner_user_id", "normalized_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_publication"
  ON "edge" ("publication_mode", "is_featured");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_source"
  ON "edge" ("source_edge_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "edge_section" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "edge_id" text NOT NULL REFERENCES "edge"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_section_edge_sort"
  ON "edge_section" ("edge_id", "sort_order");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "edge_rule" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "edge_id" text NOT NULL REFERENCES "edge"("id") ON DELETE cascade,
  "section_id" text NOT NULL REFERENCES "edge_section"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "applies_outcomes" jsonb NOT NULL DEFAULT '["all"]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_rule_edge"
  ON "edge_rule" ("edge_id", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_rule_section"
  ON "edge_rule" ("section_id", "sort_order");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "trade_edge_assignment" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "trade_id" text NOT NULL REFERENCES "trade"("id") ON DELETE cascade,
  "edge_id" text NOT NULL REFERENCES "edge"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trade_edge_assignment_trade_idx"
  ON "trade_edge_assignment" ("trade_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_edge_assignment_edge"
  ON "trade_edge_assignment" ("edge_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_edge_assignment_user"
  ON "trade_edge_assignment" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "trade_edge_rule_evaluation" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "trade_id" text NOT NULL REFERENCES "trade"("id") ON DELETE cascade,
  "edge_id" text NOT NULL REFERENCES "edge"("id") ON DELETE cascade,
  "rule_id" text NOT NULL REFERENCES "edge_rule"("id") ON DELETE cascade,
  "status" varchar(20) NOT NULL DEFAULT 'not_reviewed',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trade_edge_rule_eval_trade_rule_idx"
  ON "trade_edge_rule_evaluation" ("trade_id", "rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_edge_rule_eval_edge"
  ON "trade_edge_rule_evaluation" ("edge_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_edge_rule_eval_rule"
  ON "trade_edge_rule_evaluation" ("rule_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "edge_missed_trade" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "edge_id" text NOT NULL REFERENCES "edge"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "account_id" text REFERENCES "trading_account"("id") ON DELETE set null,
  "symbol" varchar(64) NOT NULL,
  "trade_type" varchar(8),
  "session_tag" text,
  "setup_time" timestamp,
  "reason_missed" text,
  "notes" text,
  "media_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "estimated_outcome" varchar(20),
  "estimated_rr" numeric,
  "estimated_pnl" numeric,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_missed_trade_edge"
  ON "edge_missed_trade" ("edge_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_missed_trade_user"
  ON "edge_missed_trade" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_missed_trade_account"
  ON "edge_missed_trade" ("account_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "edge_share_member" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "edge_id" text NOT NULL REFERENCES "edge"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "invited_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "role" varchar(16) NOT NULL DEFAULT 'viewer',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "edge_share_member_edge_user_idx"
  ON "edge_share_member" ("edge_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_share_member_user"
  ON "edge_share_member" ("user_id", "role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edge_share_member_edge"
  ON "edge_share_member" ("edge_id", "role");
--> statement-breakpoint

ALTER TABLE "journal_entry"
  ADD COLUMN IF NOT EXISTS "linked_edge_id" text REFERENCES "edge"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "journal_entry"
  ADD COLUMN IF NOT EXISTS "linked_missed_trade_id" text REFERENCES "edge_missed_trade"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_entry_edge"
  ON "journal_entry" ("user_id", "linked_edge_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_entry_missed_trade"
  ON "journal_entry" ("user_id", "linked_missed_trade_id");
--> statement-breakpoint

WITH normalized_trade_tags AS (
  SELECT
    ta."user_id" AS owner_user_id,
    t."model_tag" AS model_tag,
    lower(regexp_replace(trim(t."model_tag"), '\s+', ' ', 'g')) AS normalized_name,
    NULLIF(t."model_tag_color", '') AS model_tag_color,
    COALESCE(t."close_time", t."open_time", t."created_at", now()) AS activity_at
  FROM "trade" t
  INNER JOIN "trading_account" ta
    ON ta."id" = t."account_id"
  WHERE t."model_tag" IS NOT NULL
    AND trim(t."model_tag") <> ''
),
display_name_ranked AS (
  SELECT
    owner_user_id,
    normalized_name,
    model_tag AS display_name,
    count(*) AS use_count,
    max(activity_at) AS last_seen_at,
    row_number() OVER (
      PARTITION BY owner_user_id, normalized_name
      ORDER BY count(*) DESC, max(activity_at) DESC, model_tag ASC
    ) AS rank_no
  FROM normalized_trade_tags
  GROUP BY owner_user_id, normalized_name, model_tag
),
color_ranked AS (
  SELECT
    owner_user_id,
    normalized_name,
    model_tag_color,
    row_number() OVER (
      PARTITION BY owner_user_id, normalized_name
      ORDER BY activity_at DESC
    ) AS rank_no
  FROM normalized_trade_tags
  WHERE model_tag_color IS NOT NULL
),
edge_seed AS (
  SELECT
    gen_random_uuid()::text AS id,
    d.owner_user_id,
    d.normalized_name,
    d.display_name,
    COALESCE(c.model_tag_color, '#3B82F6') AS color
  FROM display_name_ranked d
  LEFT JOIN color_ranked c
    ON c.owner_user_id = d.owner_user_id
   AND c.normalized_name = d.normalized_name
   AND c.rank_no = 1
  WHERE d.rank_no = 1
)
INSERT INTO "edge" (
  "id",
  "owner_user_id",
  "name",
  "normalized_name",
  "color",
  "status",
  "publication_mode",
  "created_at",
  "updated_at"
)
SELECT
  s.id,
  s.owner_user_id,
  s.display_name,
  s.normalized_name,
  s.color,
  'active',
  'private',
  now(),
  now()
FROM edge_seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM "edge" e
  WHERE e."owner_user_id" = s.owner_user_id
    AND e."normalized_name" = s.normalized_name
);
--> statement-breakpoint

UPDATE "trade" t
SET
  "model_tag" = e."name",
  "model_tag_color" = e."color"
FROM "trading_account" ta
INNER JOIN "edge" e
  ON e."owner_user_id" = ta."user_id"
WHERE ta."id" = t."account_id"
  AND t."model_tag" IS NOT NULL
  AND trim(t."model_tag") <> ''
  AND e."normalized_name" = lower(regexp_replace(trim(t."model_tag"), '\s+', ' ', 'g'));
--> statement-breakpoint

INSERT INTO "trade_edge_assignment" (
  "id",
  "trade_id",
  "edge_id",
  "user_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  t."id",
  e."id",
  ta."user_id",
  COALESCE(t."created_at", now()),
  now()
FROM "trade" t
INNER JOIN "trading_account" ta
  ON ta."id" = t."account_id"
INNER JOIN "edge" e
  ON e."owner_user_id" = ta."user_id"
 AND e."normalized_name" = lower(regexp_replace(trim(t."model_tag"), '\s+', ' ', 'g'))
WHERE t."model_tag" IS NOT NULL
  AND trim(t."model_tag") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "trade_edge_assignment" tea
    WHERE tea."trade_id" = t."id"
  );
