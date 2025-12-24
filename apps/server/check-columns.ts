import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function checkColumns() {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'trade'
      AND column_name IN ('killzone', 'killzone_color')
      ORDER BY column_name;
    `);

    console.log("Killzone columns in database:");
    console.log(result.rows);

    if (result.rows.length === 0) {
      console.log("\n❌ NO KILLZONE COLUMNS FOUND - Migration did not apply!");
      console.log("\nAll trade table columns:");
      const allColumns = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'trade'
        ORDER BY ordinal_position;
      `);
      console.log(allColumns.rows.map((r: any) => r.column_name).join(", "));
    } else {
      console.log("\n✅ Killzone columns exist!");
    }
  } catch (error) {
    console.error("Error checking columns:", error);
  }
  process.exit(0);
}

checkColumns();
