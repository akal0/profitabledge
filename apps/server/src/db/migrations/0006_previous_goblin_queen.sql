ALTER TABLE "historical_prices" ADD COLUMN "price_type" varchar(8);--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "open_bid" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "high_bid" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "low_bid" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "close_bid" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "open_ask" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "high_ask" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "low_ask" numeric;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "close_ask" numeric;