ALTER TABLE "trade" ALTER COLUMN "symbol" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "open" timestamp;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "trade_type" varchar(8);--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "volume" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "open_price" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "sl" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "tp" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "close" timestamp;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "close_price" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "swap" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "commissions" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "profit" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "pips" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "trade_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "side";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "quantity";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "pnl";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "fee";--> statement-breakpoint
ALTER TABLE "trade" DROP COLUMN "executed_at";