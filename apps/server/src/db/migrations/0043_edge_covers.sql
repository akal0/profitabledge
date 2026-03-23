ALTER TABLE "edge"
ADD COLUMN IF NOT EXISTS "cover_image_url" text,
ADD COLUMN IF NOT EXISTS "cover_image_position" integer DEFAULT 50;
