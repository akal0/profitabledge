import type { NormalizedImportedTrade } from "../types";

export type TradovatePairedTradeSeed = {
  symbol: string;
  qty: number;
  buyFillId: string;
  sellFillId: string;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  boughtTimestamp: Date;
  soldTimestamp: Date;
  tickSize: number | null;
  priceFormat: string | null;
  currency?: string | null;
  accountNumber?: string | null;
  positionId?: string | null;
  pairId?: string | null;
  reportMeta?: Record<string, unknown>;
};

export type TradovatePairedTrade = TradovatePairedTradeSeed & {
  direction: "long" | "short";
  openTime: Date;
  closeTime: Date;
  openPrice: number;
  closePrice: number;
};

export function buildTradovatePairedTrade(
  seed: TradovatePairedTradeSeed
): TradovatePairedTrade {
  const direction = seed.boughtTimestamp <= seed.soldTimestamp ? "long" : "short";
  const openTime = direction === "long" ? seed.boughtTimestamp : seed.soldTimestamp;
  const closeTime = direction === "long" ? seed.soldTimestamp : seed.boughtTimestamp;
  const openPrice = direction === "long" ? seed.buyPrice : seed.sellPrice;
  const closePrice = direction === "long" ? seed.sellPrice : seed.buyPrice;

  return {
    ...seed,
    direction,
    openTime,
    closeTime,
    openPrice,
    closePrice,
  };
}

function buildGroupKey(trade: TradovatePairedTrade): string {
  if (trade.direction === "long") {
    return `${trade.symbol}:long:${trade.sellFillId}:${trade.closeTime.toISOString()}`;
  }

  return `${trade.symbol}:short:${trade.buyFillId}:${trade.closeTime.toISOString()}`;
}

function uniqueNonBlank(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

export function groupTradovatePairedTrades(input: {
  trades: TradovatePairedTrade[];
  reportType: "performance" | "position-history";
}): NormalizedImportedTrade[] {
  const groups = new Map<string, TradovatePairedTrade[]>();

  for (const trade of input.trades) {
    const key = buildGroupKey(trade);
    const bucket = groups.get(key) ?? [];
    bucket.push(trade);
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([key, group]) => {
    const first = group[0];
    const totalQty = group.reduce((sum, item) => sum + item.qty, 0);
    const totalPnl = group.reduce((sum, item) => sum + item.pnl, 0);
    const weightedOpenPrice =
      group.reduce((sum, item) => sum + item.openPrice * item.qty, 0) / totalQty;
    const weightedClosePrice =
      group.reduce((sum, item) => sum + item.closePrice * item.qty, 0) / totalQty;
    const openTime = new Date(
      Math.min(...group.map((item) => item.openTime.getTime()))
    );
    const closeTime = new Date(
      Math.max(...group.map((item) => item.closeTime.getTime()))
    );

    return {
      ticket: key,
      symbol: first.symbol,
      tradeType: first.direction,
      volume: totalQty,
      openPrice: weightedOpenPrice,
      closePrice: weightedClosePrice,
      openTime,
      closeTime,
      profit: totalPnl,
      sl: null,
      tp: null,
      swap: null,
      commissions: null,
      pips: null,
      comment: null,
      brokerMeta: {
        importReportType: input.reportType,
        pairedRowCount: group.length,
        buyFillIds: uniqueNonBlank(group.map((item) => item.buyFillId)),
        sellFillIds: uniqueNonBlank(group.map((item) => item.sellFillId)),
        pairIds: uniqueNonBlank(group.map((item) => item.pairId)),
        positionIds: uniqueNonBlank(group.map((item) => item.positionId)),
        accountNumbers: uniqueNonBlank(group.map((item) => item.accountNumber)),
        tickSize: first.tickSize,
        priceFormat: first.priceFormat,
        ...Object.assign({}, ...group.map((item) => item.reportMeta ?? {})),
      },
    };
  });
}
