ALTER TABLE "trade_idea_share"
ADD COLUMN IF NOT EXISTS "trade_phase" varchar(20);

ALTER TABLE "trade_idea_share"
ADD COLUMN IF NOT EXISTS "exit_price" numeric;

UPDATE "trade_idea_share"
SET "trade_phase" = 'pre-trade'
WHERE "trade_phase" IS NULL;
