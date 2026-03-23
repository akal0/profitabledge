ALTER TABLE "edge"
ADD COLUMN "content_blocks" jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "content_html" text,
ADD COLUMN "examples_blocks" jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "examples_html" text;
