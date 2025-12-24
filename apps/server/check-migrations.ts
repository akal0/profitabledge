import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function checkMigrations() {
  try {
    console.log("🔍 Checking migrations in drizzle schema...\n");

    const migrations = await db.execute(sql`
      SELECT * FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
    `);

    console.log(`Found ${migrations.rows.length} migrations:\n`);
    migrations.rows.forEach((row: any, idx: number) => {
      console.log(`${idx + 1}. Hash: ${row.hash}`);
      console.log(`   Created: ${row.created_at}`);
      console.log();
    });

    // Check migration files on disk
    console.log("📁 Checking migration files on disk...");
    const fs = require("fs");
    const path = require("path");
    const migrationsDir = path.join(__dirname, "src/db/migrations");

    const files = fs.readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    console.log(`\nFound ${files.length} SQL migration files:`);
    files.forEach((file: string, idx: number) => {
      console.log(`${idx + 1}. ${file}`);
    });

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  }
  process.exit(0);
}

checkMigrations();
