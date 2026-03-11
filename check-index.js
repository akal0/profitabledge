import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL || "");

async function checkIndex() {
  const result = await sql`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ai_action_log_user_id_idx'
  `;
  
  console.log(JSON.stringify(result, null, 2));
  
  if (result.length === 0) {
    console.log("\nIndex 'ai_action_log_user_id_idx' does not exist.");
  } else {
    console.log("\nIndex 'ai_action_log_user_id_idx' exists on table:", result[0].tablename);
  }
}

checkIndex().catch(console.error);
