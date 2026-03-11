import { db } from "../db";
import { tradingAccount } from "../db/schema/trading";
import { eq } from "drizzle-orm";
import {
  updateAccountManipulation,
  updateAccountPostExitPeaks,
} from "../lib/manipulation-calculator";

const accountId = process.argv[2];
const windowSeconds = Number(process.argv[3] || 3600);

if (!accountId) {
  console.error("Usage: node src/scripts/backfill-derived-metrics.ts <accountId> [postExitWindowSeconds]");
  process.exit(1);
}

async function main() {
  const account = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(eq(tradingAccount.id, accountId))
    .limit(1);

  if (!account.length) {
    throw new Error("Account not found");
  }

  console.log(`[backfill] account=${accountId} window=${windowSeconds}s`);

  const manipulation = await updateAccountManipulation(accountId, (current, total) => {
    if (current % 25 === 0 || current === total) {
      console.log(`[backfill] manipulation ${current}/${total}`);
    }
  });
  console.log("[backfill] manipulation done", manipulation);

  const postExit = await updateAccountPostExitPeaks(
    accountId,
    windowSeconds,
    true,
    (current, total) => {
      if (current % 25 === 0 || current === total) {
        console.log(`[backfill] post-exit ${current}/${total}`);
      }
    }
  );
  console.log("[backfill] post-exit done", postExit);
}

main()
  .then(() => {
    console.log("[backfill] complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[backfill] failed", err);
    process.exit(1);
  });
