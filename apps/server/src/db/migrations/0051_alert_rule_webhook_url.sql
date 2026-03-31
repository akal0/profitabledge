ALTER TABLE "performance_alert_rule"
ADD COLUMN IF NOT EXISTS "webhook_url" text;
