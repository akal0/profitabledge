CREATE TABLE "goal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"type" varchar(20) NOT NULL,
	"target_type" varchar(30) NOT NULL,
	"target_value" numeric NOT NULL,
	"current_value" numeric DEFAULT '0',
	"start_date" date NOT NULL,
	"deadline" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"achievements" jsonb,
	"progress_history" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "copy_group" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"master_account_id" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copy_signal" (
	"id" text PRIMARY KEY NOT NULL,
	"copy_slave_id" text NOT NULL,
	"master_ticket" text NOT NULL,
	"slave_ticket" text,
	"signal_type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"symbol" text NOT NULL,
	"trade_type" text NOT NULL,
	"master_volume" numeric NOT NULL,
	"slave_volume" numeric,
	"open_price" numeric,
	"sl" numeric,
	"tp" numeric,
	"new_sl" numeric,
	"new_tp" numeric,
	"close_price" numeric,
	"profit" numeric,
	"executed_at" timestamp,
	"executed_price" numeric,
	"slippage_pips" numeric,
	"error_message" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copy_slave" (
	"id" text PRIMARY KEY NOT NULL,
	"copy_group_id" text NOT NULL,
	"slave_account_id" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"lot_mode" text DEFAULT 'multiplier',
	"fixed_lot" numeric DEFAULT '0.01',
	"lot_multiplier" numeric DEFAULT '1.0',
	"risk_percent" numeric DEFAULT '1.0',
	"max_lot_size" numeric DEFAULT '10.0',
	"max_daily_loss" numeric,
	"max_trades_per_day" integer,
	"max_drawdown_percent" numeric,
	"sl_mode" text DEFAULT 'copy',
	"sl_fixed_pips" numeric,
	"sl_multiplier" numeric DEFAULT '1.0',
	"tp_mode" text DEFAULT 'copy',
	"tp_fixed_pips" numeric,
	"tp_multiplier" numeric DEFAULT '1.0',
	"symbol_whitelist" jsonb,
	"symbol_blacklist" jsonb,
	"session_filter" jsonb,
	"min_lot_size" numeric DEFAULT '0.01',
	"max_slippage_pips" numeric DEFAULT '3.0',
	"copy_pending_orders" boolean DEFAULT false,
	"copy_sl_tp_modifications" boolean DEFAULT true,
	"reverse_trades" boolean DEFAULT false,
	"total_copied_trades" integer DEFAULT 0,
	"total_profit" numeric DEFAULT '0',
	"last_copy_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"type" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"metadata" jsonb,
	"dedupe_key" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "ai_action_log_user_id_idx";--> statement-breakpoint
DROP INDEX "ai_action_log_intent_idx";--> statement-breakpoint
DROP INDEX "ai_action_log_status_idx";--> statement-breakpoint
DROP INDEX "ai_action_log_started_at_idx";--> statement-breakpoint
DROP INDEX "ai_chat_message_report_id_idx";--> statement-breakpoint
DROP INDEX "ai_chat_message_created_at_idx";--> statement-breakpoint
DROP INDEX "ai_report_user_id_idx";--> statement-breakpoint
DROP INDEX "ai_report_account_id_idx";--> statement-breakpoint
DROP INDEX "ai_report_created_at_idx";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notification_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "open_time" timestamp;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "close_time" timestamp;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_group" ADD CONSTRAINT "copy_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_group" ADD CONSTRAINT "copy_group_master_account_id_trading_account_id_fk" FOREIGN KEY ("master_account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_signal" ADD CONSTRAINT "copy_signal_copy_slave_id_copy_slave_id_fk" FOREIGN KEY ("copy_slave_id") REFERENCES "public"."copy_slave"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_slave" ADD CONSTRAINT "copy_slave_copy_group_id_copy_group_id_fk" FOREIGN KEY ("copy_group_id") REFERENCES "public"."copy_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_slave" ADD CONSTRAINT "copy_slave_slave_account_id_trading_account_id_fk" FOREIGN KEY ("slave_account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_goal_user" ON "goal" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_goal_account" ON "goal" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_goal_status" ON "goal" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_goal_user_status" ON "goal" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_copy_group_user" ON "copy_group" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_copy_group_master" ON "copy_group" USING btree ("master_account_id");--> statement-breakpoint
CREATE INDEX "idx_copy_signal_slave" ON "copy_signal" USING btree ("copy_slave_id");--> statement-breakpoint
CREATE INDEX "idx_copy_signal_master_ticket" ON "copy_signal" USING btree ("master_ticket");--> statement-breakpoint
CREATE INDEX "idx_copy_signal_status" ON "copy_signal" USING btree ("copy_slave_id","status");--> statement-breakpoint
CREATE INDEX "idx_copy_signal_created" ON "copy_signal" USING btree ("copy_slave_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_copy_slave_group" ON "copy_slave" USING btree ("copy_group_id");--> statement-breakpoint
CREATE INDEX "idx_copy_slave_account" ON "copy_slave" USING btree ("slave_account_id");--> statement-breakpoint
CREATE INDEX "idx_notification_user_created" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_user_dedupe" ON "notification" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_ai_action_log_user_id" ON "ai_action_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_action_log_intent" ON "ai_action_log" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "idx_ai_action_log_status" ON "ai_action_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_action_log_started_at" ON "ai_action_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_message_report_id" ON "ai_chat_message" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_message_created_at" ON "ai_chat_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_report_user_id" ON "ai_report" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_report_account_id" ON "ai_report" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_ai_report_created_at" ON "ai_report" USING btree ("created_at");