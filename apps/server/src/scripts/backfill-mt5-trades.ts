import "dotenv/config";
import { backfillMt5ProjectedTrades } from "../lib/mt5/ingestion";

function readFlag(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }

  return undefined;
}

async function main() {
  const accountId = readFlag("account-id");
  const connectionId = readFlag("connection-id");
  const emitSideEffects = process.argv.includes("--emit-side-effects");

  if (!accountId && !connectionId) {
    console.log(
      "[mt5-backfill] no account or connection filter supplied; processing all MT5 deal history"
    );
  }

  const result = await backfillMt5ProjectedTrades({
    accountId,
    connectionId,
    emitSideEffects,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[mt5-backfill] failed");
  console.error(error);
  process.exit(1);
});
