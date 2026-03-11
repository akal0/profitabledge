import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL || "");

async function checkIndexes() {
  console.log("Checking existing indexes on ai_action_log table...\n");
  
  const indexes = await sql`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_action_log'
    ORDER BY indexname
  `;
  
  console.log("Found indexes:");
  indexes.forEach(idx => {
    console.log(`  - ${idx.indexname}`);
  });
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  const renames = [
    { old: 'ai_action_log_user_id_idx', new: 'idx_ai_action_log_user_id' },
    { old: 'ai_action_log_intent_idx', new: 'idx_ai_action_log_intent' },
    { old: 'ai_action_log_status_idx', new: 'idx_ai_action_log_status' },
    { old: 'ai_action_log_started_at_idx', new: 'idx_ai_action_log_started_at' }
  ];

  for (const { old, new: newName } of renames) {
    const exists = indexes.find(idx => idx.indexname === old);
    if (!exists) {
      console.log(`⊘ Skipping ${old} - does not exist`);
      continue;
    }
    
    try {
      console.log(`Renaming ${old} to ${newName}...`);
      const query = `ALTER INDEX ${old} RENAME TO ${newName}`;
      await sql.query(query);
      console.log(`✓ Successfully renamed ${old} to ${newName}`);
    } catch (error) {
      console.error(`✗ Error renaming ${old}:`, error.message);
    }
  }
}

checkIndexes().catch(console.error);
