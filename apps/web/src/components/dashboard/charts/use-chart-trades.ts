"use client";

import { useQuery } from "@tanstack/react-query";

import { trpcClient } from "@/utils/trpc";

import { useChartRangeQueryParams } from "./use-chart-range-query-params";

const CHART_TRADE_PAGE_LIMIT = 200;
const CHART_TRADE_MAX_PAGES = 100;

export type ChartTrade = {
  id: string;
  open?: string | null;
  close?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  createdAtISO?: string | null;
  symbol?: string | null;
  tradeDirection?: string | null;
  tradeType?: string | null;
  volume?: number | null;
  profit?: number | null;
  netPnl?: number | null;
  sl?: number | null;
  tp?: number | null;
  openPrice?: number | null;
  closePrice?: number | null;
  pips?: number | null;
  holdSeconds?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  protocolAlignment?: string | null;
  outcome?: string | null;
  realisedRR?: number | null;
  mfePips?: number | null;
  maePips?: number | null;
};

function normalizeTrade(trade: any): ChartTrade {
  return {
    ...trade,
    tradeDirection: trade.tradeDirection ?? trade.tradeType ?? null,
    tradeType: trade.tradeType ?? trade.tradeDirection ?? null,
    openTime: trade.openTime ?? trade.open ?? null,
    closeTime: trade.closeTime ?? trade.close ?? null,
    netPnl: trade.netPnl ?? trade.profit ?? 0,
  };
}

export function useChartTrades(
  accountId?: string,
  rangeOverride?: {
    startISO?: string;
    endISO?: string;
  }
) {
  const globalRange = useChartRangeQueryParams();
  const startISO = rangeOverride?.startISO ?? globalRange.startISO;
  const endISO = rangeOverride?.endISO ?? globalRange.endISO;

  const query = useQuery({
    queryKey: [
      "dashboard-chart-trades",
      accountId ?? null,
      startISO ?? null,
      endISO ?? null,
    ],
    enabled: Boolean(accountId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!accountId) return [] as ChartTrade[];

      const trades: ChartTrade[] = [];
      let cursor: { createdAtISO: string; id: string } | undefined;
      let pageCount = 0;

      do {
        const page = await trpcClient.trades.listInfinite.query({
          accountId,
          limit: CHART_TRADE_PAGE_LIMIT,
          startISO,
          endISO,
          cursor,
        });

        trades.push(...page.items.map(normalizeTrade));
        cursor = page.nextCursor ?? undefined;
        pageCount += 1;
      } while (cursor && pageCount < CHART_TRADE_MAX_PAGES);

      return trades;
    },
  });

  return {
    ...query,
    trades: (query.data ?? []) as ChartTrade[],
  };
}
