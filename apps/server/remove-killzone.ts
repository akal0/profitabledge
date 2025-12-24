import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function removeKillzoneColumns() {
  try {
    console.log("Removing manually added killzone columns...");

    await db.execute(sql`ALTER TABLE "trade" DROP COLUMN IF EXISTS "killzone";`);
    console.log("✓ Removed killzone column");

    await db.execute(sql`ALTER TABLE "trade" DROP COLUMN IF EXISTS "killzone_color";`);
    console.log("✓ Removed killzone_color column");

    console.log("\n✅ Columns removed successfully!");
  } catch (error) {
    console.error("❌ Error removing columns:", error);
  }
  process.exit(0);
}

removeKillzoneColumns();
