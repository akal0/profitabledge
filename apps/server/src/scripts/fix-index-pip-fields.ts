import { sql } from "drizzle-orm";
import { db } from "../db/index";

const INDEX_PATTERNS = [
  "%US100%",
  "%NAS100%",
  "%NAS%",
  "%US500%",
  "%SPX%",
  "%SP500%",
  "%US30%",
  "%DJ30%",
  "%DOW%",
  "%GER30%",
  "%DE30%",
  "%GER40%",
  "%DE40%",
];

const FIELDS = [
  "manipulation_pips",
  "entry_spread_pips",
  "exit_spread_pips",
  "entry_slippage_pips",
  "exit_slippage_pips",
];

async function run() {
  const patterns = INDEX_PATTERNS.map((p) => `'${p}'`).join(", ");
  const updates = FIELDS.map((field) => {
    return sql.raw(
      `${field} = CASE WHEN ${field} IS NULL THEN NULL ELSE (${field}::numeric / 10000) END`
    );
  }).reduce((acc, piece, idx) => {
    if (idx === 0) return piece;
    return sql`${acc}, ${piece}`;
  }, sql``);

  const query = sql`
    UPDATE trade
    SET ${updates}
    WHERE upper(symbol) LIKE ANY (ARRAY[${sql.raw(patterns)}])
      AND (
        manipulation_pips IS NOT NULL OR
        entry_spread_pips IS NOT NULL OR
        exit_spread_pips IS NOT NULL OR
        entry_slippage_pips IS NOT NULL OR
        exit_slippage_pips IS NOT NULL
      )
  `;

  const result = await db.execute(query);
  console.log("Updated rows:", (result as any).rowCount ?? result);
  process.exit(0);
}

run().catch((err) => {
  console.error("Failed to fix index pip fields:", err);
  process.exit(1);
});
