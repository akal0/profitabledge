#!/usr/bin/env bun
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const migrationPath = resolve(
  import.meta.dir,
  "../db/migrations/0038_stripe_primary_billing.sql"
);

function splitStatements(contents: string) {
  return contents
    .split(/;\s*\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => (statement.endsWith(";") ? statement : `${statement};`));
}

async function main() {
  const statements = splitStatements(readFileSync(migrationPath, "utf-8"));
  console.log(`Applying ${statements.length} statement(s) from 0038_stripe_primary_billing.sql`);

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    await sql.query(statement);
    console.log(`  ✓ Statement ${index + 1}`);
  }

  console.log("Stripe primary billing migration applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
