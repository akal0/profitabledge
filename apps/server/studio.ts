#!/usr/bin/env bun
/**
 * Simple Database Viewer for Neon
 *
 * drizzle-kit studio doesn't work with @neondatabase/serverless driver,
 * so this provides a simple CLI-based database viewer as an alternative.
 */

import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

console.log("\n📊 Database Viewer");
console.log("==================\n");
console.log(
  "⚠️  Note: drizzle-kit studio doesn't work with Neon serverless driver\n"
);

async function viewDatabase() {
  try {
    // Get all tables
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`Found ${tables.rows.length} tables:\n`);

    for (const table of tables.rows) {
      const tableName = (table as any).table_name;
      console.log(`\n📋 Table: ${tableName}`);
      console.log("─".repeat(50));

      // Get column info
      const columns = await db.execute(sql.raw(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position;
      `));

      console.log("\nColumns:");
      for (const col of columns.rows) {
        const c = col as any;
        const nullable = c.is_nullable === "YES" ? "NULL" : "NOT NULL";
        const defaultVal = c.column_default
          ? ` DEFAULT ${c.column_default}`
          : "";
        console.log(
          `  • ${c.column_name}: ${c.data_type} ${nullable}${defaultVal}`
        );
      }

      // Get row count
      const count = await db.execute(
        sql.raw(`SELECT COUNT(*) as count FROM "${tableName}";`)
      );
      const rowCount = Number((count.rows[0] as any).count);
      console.log(`\nRows: ${rowCount}`);

      // Show first 3 rows if any exist
      if (rowCount > 0 && rowCount < 1000) {
        try {
          const rows = await db.execute(
            sql.raw(`SELECT * FROM "${tableName}" LIMIT 3;`)
          );
          if (rows.rows.length > 0) {
            console.log("\nSample data (first 3 rows):");
            console.log(JSON.stringify(rows.rows, null, 2));
          }
        } catch (e) {
          console.log("  (Could not fetch sample data)");
        }
      }
    }

    console.log("\n\n✅ Alternative Database Viewers:\n");
    console.log("1. Neon Web Console: https://console.neon.tech");
    console.log("2. GUI Clients: TablePlus, DBeaver, pgAdmin, Postico");
    console.log(
      "3. Connection String: " +
        (process.env.DATABASE_URL || "").replace(/:[^:@]+@/, ":***@") +
        "\n"
    );

    process.exit(0);
  } catch (error) {
    console.error("✗ Error:", error);
    process.exit(1);
  }
}

viewDatabase();
