import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { and, isNotNull } from "drizzle-orm";

import { db } from "../db";
import { billingCustomer } from "../db/schema/billing";

const DEFAULT_OUTPUT_PATH = resolve(
  process.cwd(),
  "tmp/stripe-payment-data-mapping.csv"
);

function toCsvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value);
  if (
    normalized.includes(",") ||
    normalized.includes("\"") ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`;
  }

  return normalized;
}

async function main() {
  const outFlag = process.argv.find((value) => value.startsWith("--out="));
  const outPath = outFlag ? resolve(outFlag.slice(6)) : DEFAULT_OUTPUT_PATH;

  const rows = await db
    .select({
      polarCustomerId: billingCustomer.polarCustomerId,
      stripeCustomerId: billingCustomer.stripeCustomerId,
      userId: billingCustomer.userId,
    })
    .from(billingCustomer)
    .where(
      and(
        isNotNull(billingCustomer.polarCustomerId),
        isNotNull(billingCustomer.stripeCustomerId)
      )
    );

  const csvRows: string[][] = [["old_customer_id", "stripe_customer_id"]];

  for (const row of rows) {
    if (!row.polarCustomerId || !row.stripeCustomerId) {
      continue;
    }

    csvRows.push([
      toCsvCell(row.polarCustomerId),
      toCsvCell(row.stripeCustomerId),
    ]);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, csvRows.map((row) => row.join(",")).join("\n"));

  const summaryPath = outPath.replace(/\.csv$/i, ".summary.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        outPath,
        rowCount: csvRows.length - 1,
        missingPairCount: rows.length - (csvRows.length - 1),
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        outPath,
        summaryPath,
        rowCount: csvRows.length - 1,
        missingPairCount: rows.length - (csvRows.length - 1),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
