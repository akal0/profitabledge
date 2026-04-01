ALTER TABLE "billing_entitlement_override"
ADD COLUMN IF NOT EXISTS "metadata" jsonb;
