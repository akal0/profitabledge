CREATE TABLE IF NOT EXISTS "affiliate_payment_method" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "method_type" varchar(32) NOT NULL,
  "label" text NOT NULL,
  "recipient_name" text,
  "details" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_payment_method_affiliate_idx" ON "affiliate_payment_method" ("affiliate_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_payment_method_default_idx" ON "affiliate_payment_method" ("affiliate_user_id","is_default");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "affiliate_payout" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "payment_method_id" text REFERENCES "affiliate_payment_method"("id") ON DELETE set null,
  "amount" integer NOT NULL DEFAULT 0,
  "currency" varchar(10) NOT NULL DEFAULT 'USD',
  "event_count" integer NOT NULL DEFAULT 0,
  "status" varchar(24) NOT NULL DEFAULT 'paid',
  "external_reference" text,
  "notes" text,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "paid_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_payout_affiliate_paid_idx" ON "affiliate_payout" ("affiliate_user_id","paid_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_payout_payment_method_idx" ON "affiliate_payout" ("payment_method_id");--> statement-breakpoint

ALTER TABLE "affiliate_commission_event"
  ADD COLUMN IF NOT EXISTS "affiliate_payout_id" text REFERENCES "affiliate_payout"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "paid_out_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_commission_event_payout_idx" ON "affiliate_commission_event" ("affiliate_payout_id","occurred_at");--> statement-breakpoint
