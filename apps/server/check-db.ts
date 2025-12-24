import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function checkDb() {
  try {
    // Simple query to test connection
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Database connection works");

    // Check if drizzle migrations table exists
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'drizzle'
      AND table_name = '__drizzle_migrations'
    `);
    console.log("Drizzle migrations table exists:", tables.rows.length > 0);

    if (tables.rows.length > 0) {
      // Check last few migrations
      const migrations = await db.execute(sql`
        SELECT * FROM drizzle.__drizzle_migrations
        ORDER BY created_at DESC LIMIT 5
      `);
      console.log("Recent migrations:", migrations.rows);
    }
  } catch (error: any) {
    console.error("❌ Database error:", error.message);
  }
  process.exit(0);
}

checkDb();
