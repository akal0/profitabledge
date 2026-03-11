import "dotenv/config";
import { Client } from "pg";
import fs from "fs";
import path from "path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const scriptPath = path.join(
    __dirname,
    "rename-ai-action-log-indexes.sql"
  );
  const sql = fs.readFileSync(scriptPath, "utf8");
  const client = new Client({ connectionString: url });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Renamed AI indexes (if present).");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to rename indexes:", error);
  process.exit(1);
});
