import "dotenv/config";
import { Client } from "pg";

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const accountId = getArgValue("--account-id");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");

    const duplicateGroupsQuery = `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT 1
        FROM historical_prices
        WHERE account_id IS NOT NULL
          ${accountId ? "AND account_id = $1" : ""}
        GROUP BY account_id, symbol, timeframe, "time"
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `;

    const duplicateRowsQuery = `
      WITH ranked AS (
        SELECT
          ctid,
          ROW_NUMBER() OVER (
            PARTITION BY account_id, symbol, timeframe, "time"
            ORDER BY created_at DESC, id DESC
          ) AS row_number
        FROM historical_prices
        WHERE account_id IS NOT NULL
          ${accountId ? "AND account_id = $1" : ""}
      )
      DELETE FROM historical_prices hp
      USING ranked
      WHERE hp.ctid = ranked.ctid
        AND ranked.row_number > 1
      RETURNING hp.id
    `;

    const params = accountId ? [accountId] : [];
    const duplicateGroupsResult = await client.query<{ count: number }>(
      duplicateGroupsQuery,
      params
    );
    const deletedRowsResult = await client.query<{ id: string }>(
      duplicateRowsQuery,
      params
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          accountId: accountId ?? null,
          duplicateGroupsFound: duplicateGroupsResult.rows[0]?.count ?? 0,
          duplicateRowsDeleted: deletedRowsResult.rowCount ?? 0,
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[dedupe-historical-prices] failed");
  console.error(error);
  process.exit(1);
});
