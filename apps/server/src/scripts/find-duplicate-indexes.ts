import "dotenv/config";
import { Client } from "pg";

type Row = {
  index_name: string;
  table_name: string;
  schema_name: string;
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const res = await client.query<Row>(`
      SELECT
        i.relname AS index_name,
        t.relname AS table_name,
        n.nspname AS schema_name
      FROM pg_class i
      JOIN pg_index ix ON ix.indexrelid = i.oid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = 'public'
      ORDER BY index_name, table_name;
    `);

    const grouped = new Map<string, Row[]>();
    for (const row of res.rows) {
      const list = grouped.get(row.index_name) || [];
      list.push(row);
      grouped.set(row.index_name, list);
    }

    const duplicates = Array.from(grouped.entries()).filter(
      ([, rows]) => rows.length > 1
    );

    if (duplicates.length === 0) {
      console.log("No duplicate index names found in public schema.");
      return;
    }

    console.log("Duplicate index names found:");
    for (const [name, rows] of duplicates) {
      const targets = rows
        .map((row) => `${row.schema_name}.${row.table_name}`)
        .join(", ");
      console.log(`- ${name}: ${targets}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to scan indexes:", error);
  process.exit(1);
});
