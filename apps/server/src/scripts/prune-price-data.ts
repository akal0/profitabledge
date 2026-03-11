import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { eaCandleDataSet } from "../db/schema/backtest";
import { historicalPrices } from "../db/schema/trading";

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const historicalPriceDaysRaw = getArgValue("--historical-price-days");
  const accountId = getArgValue("--account-id");
  const deleteEaCandles = process.argv.includes("--delete-ea-candles");

  let deletedHistoricalPrices = 0;
  let deletedEaDatasets = 0;

  if (historicalPriceDaysRaw) {
    const days = Number(historicalPriceDaysRaw);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error("--historical-price-days must be a positive number");
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(historicalPrices)
      .where(
        accountId
          ? and(
              eq(historicalPrices.accountId, accountId),
              lt(historicalPrices.time, cutoff)
            )
          : lt(historicalPrices.time, cutoff)
      )
      .returning({ id: historicalPrices.id });
    deletedHistoricalPrices = deleted.length;
  }

  if (deleteEaCandles) {
    const deleted = accountId
      ? await db
          .delete(eaCandleDataSet)
          .where(eq(eaCandleDataSet.accountId, accountId))
          .returning({ id: eaCandleDataSet.id })
      : await db
          .delete(eaCandleDataSet)
          .returning({ id: eaCandleDataSet.id });
    deletedEaDatasets = deleted.length;
  }

  console.log(
    JSON.stringify(
      {
        deletedHistoricalPrices,
        deletedEaDatasets,
        accountId: accountId ?? null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[prune-price-data] failed");
  console.error(error);
  process.exit(1);
});
