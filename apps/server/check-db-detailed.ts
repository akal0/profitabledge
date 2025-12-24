import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function checkDb() {
  try {
    console.log("🔍 Checking database connection...");
    await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Database connection works\n");

    // Check all schemas
    console.log("📊 Checking schemas...");
    const schemas = await db.execute(sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name
    `);
    console.log("Schemas:", schemas.rows);
    console.log();

    // Check drizzle migrations in public schema
    console.log("🔍 Checking for __drizzle_migrations table...");
    const tablesPublic = await db.execute(sql`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_name = '__drizzle_migrations'
    `);
    console.log("__drizzle_migrations table:", tablesPublic.rows);
    console.log();

    // Try to get migrations from public schema
    try {
      const migrations = await db.execute(sql`
        SELECT * FROM public.__drizzle_migrations
        ORDER BY created_at DESC LIMIT 10
      `);
      console.log("Migrations found:", migrations.rows.length);
      console.log("Recent migrations:", migrations.rows);
    } catch (e: any) {
      console.log("Could not read migrations from public schema:", e.message);
    }
    console.log();

    // Check all tables in public schema
    console.log("📋 All tables in public schema:");
    const allTables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log("Tables:", allTables.rows.map((r: any) => r.table_name).join(", "));
    console.log();

    // Check if specific tables from migration exist
    console.log("🔍 Checking for tables from migration 0007:");
    const checkTables = ['api_key', 'open_trade', 'historical_prices', 'trading_account', 'trade'];
    for (const tableName of checkTables) {
      const exists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = ${tableName}
        )
      `);
      console.log(`  ${tableName}: ${exists.rows[0]?.exists ? '✅ exists' : '❌ missing'}`);
    }

  } catch (error: any) {
    console.error("❌ Database error:", error.message);
    console.error(error);
  }
  process.exit(0);
}

checkDb();
