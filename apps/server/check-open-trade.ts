import { db } from "./src/db";
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'open_trade' 
  AND column_name = 'open_time'
  ORDER BY column_name;
`);

console.log("open_time column in open_trade table:");
console.log(JSON.stringify(result.rows, null, 2));

process.exit(0);
