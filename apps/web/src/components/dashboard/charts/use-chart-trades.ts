"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";

import { trpcClient } from "@/utils/trpc";

import { useChartRenderMode } from "./chart-render-mode";
import { useChartRangeQueryParams } from "./use-chart-range-query-params";

const CHART_TRADE_PAGE_LIMIT = 200;
const CHART_TRADE_MAX_PAGES = 100;
const EMBEDDED_CHART_TRADE_PAGE_LIMIT = 100;
const EMBEDDED_CHART_TRADE_MAX_PAGES = 10;
const EMBEDDED_CHART_TRADE_MAX_ITEMS = 1000;

function getEmbeddedDefaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 89);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

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
  },
  options?: {
    enabled?: boolean;
  }
) {
  const renderMode = useChartRenderMode();
  const globalRange = useChartRangeQueryParams();
  const embeddedFallbackRange = React.useMemo(
    () => (renderMode === "embedded" ? getEmbeddedDefaultRange() : null),
    [renderMode]
  );
  const startISO =
    rangeOverride?.startISO ??
    globalRange.startISO ??
    embeddedFallbackRange?.startISO;
  const endISO =
    rangeOverride?.endISO ?? globalRange.endISO ?? embeddedFallbackRange?.endISO;
  const pageLimit =
    renderMode === "embedded"
      ? EMBEDDED_CHART_TRADE_PAGE_LIMIT
      : CHART_TRADE_PAGE_LIMIT;
  const maxPages =
    renderMode === "embedded"
      ? EMBEDDED_CHART_TRADE_MAX_PAGES
      : CHART_TRADE_MAX_PAGES;
  const maxItems =
    renderMode === "embedded"
      ? EMBEDDED_CHART_TRADE_MAX_ITEMS
      : Number.POSITIVE_INFINITY;

  const query = useQuery({
    queryKey: [
      "dashboard-chart-trades",
      accountId ?? null,
      startISO ?? null,
      endISO ?? null,
      renderMode,
    ],
    enabled: Boolean(accountId) && (options?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async () => {
      if (!accountId) return [] as ChartTrade[];

      const trades: ChartTrade[] = [];
      let cursor: { createdAtISO: string; id: string } | undefined;
      let pageCount = 0;

      do {
        const page = await trpcClient.trades.listInfinite.query({
          accountId,
          limit: pageLimit,
          startISO,
          endISO,
          cursor,
        });

        trades.push(...page.items.map(normalizeTrade));
        if (trades.length >= maxItems) {
          return trades.slice(0, maxItems);
        }
        cursor =
          "nextCursor" in page ? (page.nextCursor ?? undefined) : undefined;
        pageCount += 1;
      } while (cursor && pageCount < maxPages);

      return trades;
    },
  });

  return {
    ...query,
    trades: (query.data ?? []) as ChartTrade[],
  };
}
