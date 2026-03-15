export async function seedDemoDigests(input: {
  userId: string;
  accountId: string;
  now: number;
  closedTrades: Array<{
    symbol?: string | null;
    sessionTag?: string | null;
    modelTag?: string | null;
    protocolAlignment?: string | null;
    profit?: string | number | null;
  }>;
  totalProfit: number;
  winRate: number;
  alignedTradeCount: number;
  totalLosses: number;
}) {
  const bestTrade = input.closedTrades.find(
    (tradeRow) => Number(tradeRow.profit ?? 0) > 0
  );
  const weakestTrade = input.closedTrades.find(
    (tradeRow) => Number(tradeRow.profit ?? 0) < 0
  );

  return {
    bestSession: bestTrade?.sessionTag ?? "London",
    bestSymbol: bestTrade?.symbol ?? "EURUSD",
    bestModel: bestTrade?.modelTag ?? "Discretionary",
    weakestSymbol: weakestTrade?.symbol ?? "XAUUSD",
    weakestSession: weakestTrade?.sessionTag ?? "New York",
    weakestProtocol: weakestTrade?.protocolAlignment ?? "discretionary",
  };
}
