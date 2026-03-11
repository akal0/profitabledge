ALTER TABLE "user" ADD COLUMN "advanced_metrics_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "manipulation_high" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "manipulation_low" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "manipulation_pips" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "entry_peak_price" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "entry_peak_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "post_exit_peak_price" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "post_exit_peak_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "post_exit_sampling_duration" integer;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "alpha_weighted_mpe" numeric DEFAULT '0.30';--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "be_threshold_pips" numeric DEFAULT '0.5';--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "killzone" text;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "killzone_color" varchar(7);