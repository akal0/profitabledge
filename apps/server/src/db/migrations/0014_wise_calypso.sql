CREATE TABLE "prop_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"alert_type" varchar(20) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"rule" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"current_value" numeric,
	"threshold_value" numeric,
	"metadata" jsonb,
	"acknowledged" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prop_challenge_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"prop_firm_id" text NOT NULL,
	"challenge_type" text NOT NULL,
	"display_name" text NOT NULL,
	"phases" jsonb NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prop_daily_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"date" date NOT NULL,
	"starting_balance" numeric NOT NULL,
	"starting_equity" numeric NOT NULL,
	"ending_balance" numeric NOT NULL,
	"ending_equity" numeric NOT NULL,
	"daily_profit" numeric NOT NULL,
	"daily_profit_percent" numeric NOT NULL,
	"daily_high_water_mark" numeric,
	"daily_drawdown" numeric,
	"daily_drawdown_percent" numeric,
	"trades_count" integer DEFAULT 0,
	"is_trading_day" boolean DEFAULT false,
	"breached_daily_loss" boolean DEFAULT false,
	"breached_max_loss" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prop_firm" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"logo" text,
	"website" text,
	"supported_platforms" jsonb,
	"broker_detection_patterns" jsonb,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal" ADD COLUMN "custom_criteria" jsonb;--> statement-breakpoint
ALTER TABLE "goal" ADD COLUMN "is_custom" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "is_prop_account" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_firm_id" text;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_challenge_rule_id" text;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_current_phase" integer;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_start_date" date;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_start_balance" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_start_equity" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_daily_high_water_mark" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_high_water_mark" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_current_profit" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_current_profit_percent" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_trading_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_status" varchar(20);--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_best_day_profit" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_phase_best_day_profit_percent" numeric;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_manual_override" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "trading_account" ADD COLUMN "prop_detected_firm_id" text;--> statement-breakpoint
ALTER TABLE "prop_alert" ADD CONSTRAINT "prop_alert_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prop_challenge_rule" ADD CONSTRAINT "prop_challenge_rule_prop_firm_id_prop_firm_id_fk" FOREIGN KEY ("prop_firm_id") REFERENCES "public"."prop_firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prop_daily_snapshot" ADD CONSTRAINT "prop_daily_snapshot_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prop_alert_account" ON "prop_alert" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_prop_alert_severity" ON "prop_alert" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_prop_alert_account_severity" ON "prop_alert" USING btree ("account_id","severity");--> statement-breakpoint
CREATE INDEX "idx_prop_challenge_rule_firm" ON "prop_challenge_rule" USING btree ("prop_firm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_prop_daily_snapshot_account_date" ON "prop_daily_snapshot" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "idx_prop_daily_snapshot_account" ON "prop_daily_snapshot" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_prop_daily_snapshot_date" ON "prop_daily_snapshot" USING btree ("date");