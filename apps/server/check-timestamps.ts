import { db } from "./src/db";
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'trade' 
  AND column_name IN ('open_time', 'close_time', 'open', 'close')
  ORDER BY column_name;
`);

console.log("Timestamp columns in trade table:");
console.log(JSON.stringify(result.rows, null, 2));

process.exit(0);
