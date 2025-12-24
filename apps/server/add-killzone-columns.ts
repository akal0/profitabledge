import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function addKillzoneColumns() {
  try {
    console.log("Adding killzone columns to trade table...");

    // Add killzone column
    await db.execute(sql`ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "killzone" text;`);
    console.log("✓ Added killzone column");

    // Add killzone_color column
    await db.execute(sql`ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "killzone_color" varchar(7);`);
    console.log("✓ Added killzone_color column");

    // Verify
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'trade'
      AND column_name IN ('killzone', 'killzone_color')
      ORDER BY column_name;
    `);

    console.log("\n✅ Columns added successfully!");
    console.log("Verification:", result.rows);
  } catch (error) {
    console.error("❌ Error adding columns:", error);
  }
  process.exit(0);
}

addKillzoneColumns();
