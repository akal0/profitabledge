ALTER TABLE "affiliate_commission_event"
  ADD COLUMN IF NOT EXISTS "referred_username" TEXT;

ALTER TABLE "affiliate_commission_event"
  ADD COLUMN IF NOT EXISTS "referred_email" TEXT;

ALTER TABLE "affiliate_commission_event"
  ADD COLUMN IF NOT EXISTS "plan_key" VARCHAR(40);

UPDATE "affiliate_commission_event" AS ace
SET
  "referred_username" = COALESCE(
    ace."referred_username",
    (
      SELECT u."username"
      FROM "user" AS u
      WHERE u."id" = ace."referred_user_id"
      LIMIT 1
    )
  ),
  "referred_email" = COALESCE(
    ace."referred_email",
    (
      SELECT u."email"
      FROM "user" AS u
      WHERE u."id" = ace."referred_user_id"
      LIMIT 1
    )
  ),
  "plan_key" = COALESCE(
    ace."plan_key",
    (
      SELECT bo."plan_key"
      FROM "billing_order" AS bo
      WHERE bo."polar_order_id" = ace."polar_order_id"
      LIMIT 1
    )
  );
