CREATE TABLE IF NOT EXISTS "conversation" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE CASCADE,
  "title" text DEFAULT 'New conversation',
  "last_message_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "public"."conversation"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL,
  "content" text NOT NULL,
  "widgets" jsonb DEFAULT '[]'::jsonb,
  "tool_calls" jsonb DEFAULT '[]'::jsonb,
  "context" jsonb,
  "account_id" text REFERENCES "public"."trading_account"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_conversation_user"
ON "conversation" USING btree ("user_id", "last_message_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_message_conversation"
ON "message" USING btree ("conversation_id", "created_at");

INSERT INTO "conversation" (
  "id",
  "user_id",
  "title",
  "last_message_at",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "user_id",
  COALESCE(NULLIF("title", ''), 'New conversation'),
  COALESCE("updated_at", "created_at", now()),
  COALESCE("created_at", now()),
  COALESCE("updated_at", "created_at", now())
FROM "ai_report"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "message" (
  "id",
  "conversation_id",
  "role",
  "content",
  "widgets",
  "tool_calls",
  "context",
  "account_id",
  "created_at"
)
SELECT
  m."id",
  m."report_id",
  LEFT(COALESCE(m."role", 'assistant'), 16),
  m."content",
  CASE
    WHEN m."data" IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(
      jsonb_build_object(
        'type',
        'legacy-data',
        'data',
        m."data"
      )
    )
  END,
  '[]'::jsonb,
  NULL,
  r."account_id",
  COALESCE(m."created_at", now())
FROM "ai_chat_message" m
INNER JOIN "ai_report" r
  ON r."id" = m."report_id"
ON CONFLICT ("id") DO NOTHING;
