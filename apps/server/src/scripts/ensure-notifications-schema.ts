import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb'
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS "notification" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
        "account_id" text REFERENCES "trading_account"("id") ON DELETE cascade,
        "type" varchar(32) NOT NULL,
        "title" text NOT NULL,
        "body" text,
        "metadata" jsonb,
        "dedupe_key" text,
        "read_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(
      'CREATE INDEX IF NOT EXISTS "idx_notification_user_created" ON "notification" ("user_id", "created_at")'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS "idx_notification_user_dedupe" ON "notification" ("user_id", "dedupe_key")'
    );

    await client.query("COMMIT");
    console.log("Notifications schema ensured.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to ensure notifications schema:", error);
  process.exit(1);
});
