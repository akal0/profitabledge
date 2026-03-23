"use client";

export type TradeDrawdownResult =
  | {
      id: string;
      adversePips: number | null;
      adverseUsd?: number | null;
      pctToSL?: number | null;
      pctToStoploss?: number | null;
      hit: "Stop loss" | "CLOSE" | "NONE" | "BE";
      note?: string;
      dataSource?: string;
      candleRange?: {
        from: string;
        to: string;
        utcOffset: number;
        receivedFrom?: string | null;
        receivedTo?: string | null;
        count?: number;
      } | null;
      tickRange?: {
        from: string;
        to: string;
        utcOffset: number;
      } | null;
      error?: string;
    }
  | null
  | undefined;

export type TradeDrawdownMap = Record<string, TradeDrawdownResult>;

export function createTradeDrawdownMap(results: TradeDrawdownResult[]) {
  return results.reduce<TradeDrawdownMap>((accumulator, result) => {
    if (result?.id) {
      accumulator[result.id] = result;
    }
    return accumulator;
  }, {});
}
