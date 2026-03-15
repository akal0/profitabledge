CREATE TABLE IF NOT EXISTS "activation_milestone" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "key" varchar(80) NOT NULL,
  "source" varchar(40) NOT NULL DEFAULT 'app',
  "count" integer NOT NULL DEFAULT 1,
  "first_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at" timestamp NOT NULL DEFAULT now(),
  "metadata" jsonb
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "activation_milestone_user_key_idx" ON "activation_milestone" ("user_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activation_milestone_user_seen_idx" ON "activation_milestone" ("user_id","last_seen_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "app_event" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "category" varchar(40) NOT NULL,
  "name" varchar(80) NOT NULL,
  "level" varchar(20) NOT NULL DEFAULT 'info',
  "source" varchar(40) NOT NULL DEFAULT 'server',
  "page_path" text,
  "summary" text,
  "fingerprint" varchar(160),
  "metadata" jsonb,
  "is_user_visible" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_event_user_created_idx" ON "app_event" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_event_category_created_idx" ON "app_event" ("category","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_event_fingerprint_idx" ON "app_event" ("fingerprint");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "email" text,
  "category" varchar(30) NOT NULL,
  "priority" varchar(20) NOT NULL DEFAULT 'normal',
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "page_path" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_user_created_idx" ON "user_feedback" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_status_created_idx" ON "user_feedback" ("status","created_at");
