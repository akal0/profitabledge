ALTER TABLE "trade" ADD COLUMN "mfe_pips" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "mae_pips" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "mpe_manip_leg_r" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "mpe_manip_pe_r" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "max_rr" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "raw_stdv" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "raw_stdv_pe" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "stdv_bucket" varchar(16);--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "estimated_weighted_mpe_r" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "realised_rr" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "rr_capture_efficiency" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "manip_rr_efficiency" numeric;--> statement-breakpoint
ALTER TABLE "trade" ADD COLUMN "exit_efficiency" numeric;