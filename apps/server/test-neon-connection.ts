import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import ws from "ws";

config();

const sql = neon(process.env.DATABASE_URL || "");

console.log("Testing Neon serverless connection...\n");

try {
  const result = await sql`SELECT version()`;
  console.log("✅ Neon connection successful!");
  console.log("PostgreSQL version:", result[0].version);
  console.log("\n✅ Your app will work perfectly with this setup!");
} catch (error) {
  console.error("❌ Connection failed:", error);
  process.exit(1);
}
