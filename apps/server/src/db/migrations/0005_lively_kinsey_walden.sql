ALTER TABLE "historical_prices" ALTER COLUMN "open" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "historical_prices" ALTER COLUMN "high" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "historical_prices" ALTER COLUMN "low" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "historical_prices" ALTER COLUMN "close" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "bid_price" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "ask_price" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "bid_volume" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "ask_volume" numeric;