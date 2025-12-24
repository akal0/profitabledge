CREATE TABLE "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "open_trade" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"ticket" varchar(100) NOT NULL,
	"symbol" varchar(64) NOT NULL,
	"trade_type" varchar(8) NOT NULL,
	"volume" numeric NOT NULL,
	"open_price" numeric NOT NULL,
	"open_time" timestamp NOT NULL,
	"sl" numeric,
	"tp" numeric,
	"current_price" numeric,
	"swap" numeric DEFAULT '0',
	"commission" numeric DEFAULT '0',
	"profit" numeric DEFAULT '0',
	"comment" text,
	"magic_number" integer,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "use_broker_data" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "broker_type" varchar(50);--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "broker_server" varchar(255);--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "account_number" varchar(100);--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "preferred_data_source" varchar(50) DEFAULT 'dukascopy';--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "average_spread_pips" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "is_verified" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "live_balance" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "live_equity" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "live_margin" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "live_free_margin" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_trade" ADD CONSTRAINT "open_trade_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD CONSTRAINT "historical_prices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD CONSTRAINT "historical_prices_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;