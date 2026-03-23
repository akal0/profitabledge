ALTER TABLE "edge"
ADD COLUMN IF NOT EXISTS "is_demo_seeded" boolean NOT NULL DEFAULT false;
