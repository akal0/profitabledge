import { updateTradeManipulation, updateTradePostExitPeak } from "../../manipulation-calculator";

export async function enrichManualTradeFromPriceHistory(input: {
  tradeId: string;
  accountId: string;
  postExitWindowSeconds?: number;
}) {
  const result = {
    manipulationUpdated: false,
    postExitUpdated: false,
  };

  try {
    await updateTradeManipulation(input.tradeId, input.accountId);
    result.manipulationUpdated = true;
  } catch (error) {
    console.warn("[ManualTrades] Manipulation enrichment skipped:", error);
  }

  try {
    await updateTradePostExitPeak(
      input.tradeId,
      input.accountId,
      input.postExitWindowSeconds ?? 3600
    );
    result.postExitUpdated = true;
  } catch (error) {
    console.warn("[ManualTrades] Post-exit enrichment skipped:", error);
  }

  return result;
}
