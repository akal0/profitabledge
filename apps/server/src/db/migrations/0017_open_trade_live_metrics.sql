ALTER TABLE "open_trade"
ADD COLUMN "sl_mod_count" integer,
ADD COLUMN "tp_mod_count" integer,
ADD COLUMN "partial_close_count" integer,
ADD COLUMN "entry_deal_count" integer,
ADD COLUMN "exit_deal_count" integer,
ADD COLUMN "entry_volume" numeric,
ADD COLUMN "exit_volume" numeric,
ADD COLUMN "scale_in_count" integer,
ADD COLUMN "scale_out_count" integer,
ADD COLUMN "trailing_stop_detected" boolean,
ADD COLUMN "session_tag" text,
ADD COLUMN "session_tag_color" varchar(7);
