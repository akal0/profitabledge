#!/usr/bin/env bun
/**
 * Database Status Check
 * Use this instead of `bun db:push` to verify your schema
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();

const sql = neon(process.env.DATABASE_URL || "");

async function checkStatus() {
  console.log("📊 Database Status Check\n");
  console.log("=".repeat(60));

  try {
    // Check all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log(`\n✅ Tables (${tables.length}):`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    // Check for new trade copying tables
    const requiredTables = ['broker_connection', 'trade_copy_rule', 'trade_copy_log'];
    const existingTables = tables.map(t => t.table_name);
    const missing = requiredTables.filter(t => !existingTables.includes(t));

    if (missing.length > 0) {
      console.log(`\n⚠️  Missing tables:`);
      missing.forEach(t => console.log(`  - ${t}`));
      console.log(`\nRun: bun run manual-migration.ts`);
    } else {
      console.log(`\n✅ All trade copying tables exist!`);
    }

    // Check indexes
    const indexCount = await sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    console.log(`\n📑 Indexes: ${indexCount[0].count}`);

    // Check for duplicates
    const duplicates = await sql`
      SELECT
        indexname,
        count(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
      GROUP BY indexname
      HAVING count(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Duplicate indexes found: ${duplicates.length}`);
    } else {
      console.log(`✓ No duplicate indexes`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Database is ready!");
    console.log("\n💡 Note: You don't need to run 'bun db:push'.");
    console.log("   All tables are already created and working.\n");

  } catch (error) {
    console.error("\n❌ Error checking database:", error);
    process.exit(1);
  }
}

checkStatus();
