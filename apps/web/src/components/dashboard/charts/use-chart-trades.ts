"use client";

import { useQuery } from "@tanstack/react-query";
import { convertCurrencyAmount } from "@profitabledge/contracts/currency";
import React from "react";

import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import {
  getAvailableDashboardCurrencyCodes,
  resolveDashboardCurrencyCode,
} from "@/features/dashboard/home/lib/dashboard-currency";
import { isAllAccountsScope, useAccountStore } from "@/stores/account";
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
  accountId?: string | null;
  open?: string | null;
  close?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  createdAtISO?: string | null;
  symbol?: string | null;
  rawSymbol?: string | null;
  symbolGroup?: string | null;
  tradeDirection?: string | null;
  tradeType?: string | null;
  volume?: number | null;
  profit?: number | null;
  netPnl?: number | null;
  commissions?: number | null;
  swap?: number | null;
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
  const profit = Number(trade.profit ?? 0);
  const commissions = Number(trade.commissions ?? 0);
  const swap = Number(trade.swap ?? 0);

  return {
    ...trade,
    tradeDirection: trade.tradeDirection ?? trade.tradeType ?? null,
    tradeType: trade.tradeType ?? trade.tradeDirection ?? null,
    openTime: trade.openTime ?? trade.open ?? null,
    closeTime: trade.closeTime ?? trade.close ?? null,
    netPnl: Number.isFinite(Number(trade.netPnl))
      ? Number(trade.netPnl)
      : profit + commissions + swap,
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
  const { accounts } = useAccountCatalog({ enabled: Boolean(accountId) });
  const allAccountsPreferredCurrencyCode = useAccountStore(
    (state) => state.allAccountsPreferredCurrencyCode
  );
  const embeddedFallbackRange = React.useMemo(
    () => (renderMode === "embedded" ? getEmbeddedDefaultRange() : null),
    [renderMode]
  );
  const resolvedCurrencyCode = React.useMemo(() => {
    const availableCurrencyCodes = getAvailableDashboardCurrencyCodes(accounts);
    const selectedAccountCurrency =
      accounts.find((account) => account.id === accountId)?.initialCurrency ??
      null;

    return resolveDashboardCurrencyCode({
      isAllAccounts: isAllAccountsScope(accountId),
      preferredCurrencyCode: allAccountsPreferredCurrencyCode,
      availableCurrencyCodes,
      selectedAccountCurrency,
    });
  }, [accountId, accounts, allAccountsPreferredCurrencyCode]);
  const accountCurrencyById = React.useMemo(
    () =>
      new Map(
        accounts.map((account) => [account.id, account.initialCurrency ?? null])
      ),
    [accounts]
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

  const trades = React.useMemo(() => {
    const rawTrades = (query.data ?? []) as ChartTrade[];

    if (!isAllAccountsScope(accountId) || !resolvedCurrencyCode) {
      return rawTrades;
    }

    return rawTrades.map((trade) => {
      const sourceCurrency = accountCurrencyById.get(String(trade.accountId || ""));
      const convertedProfit =
        trade.profit == null
          ? trade.profit
          : convertCurrencyAmount(
              Number(trade.profit ?? 0),
              sourceCurrency,
              resolvedCurrencyCode
            );
      const convertedNetPnl =
        trade.netPnl == null
          ? trade.netPnl
          : convertCurrencyAmount(
              Number(trade.netPnl ?? 0),
              sourceCurrency,
              resolvedCurrencyCode
            );
      const convertedCommissions =
        trade.commissions == null
          ? trade.commissions
          : convertCurrencyAmount(
              Number(trade.commissions ?? 0),
              sourceCurrency,
              resolvedCurrencyCode
            );
      const convertedSwap =
        trade.swap == null
          ? trade.swap
          : convertCurrencyAmount(
              Number(trade.swap ?? 0),
              sourceCurrency,
              resolvedCurrencyCode
            );

      if (
        convertedProfit === trade.profit &&
        convertedNetPnl === trade.netPnl &&
        convertedCommissions === trade.commissions &&
        convertedSwap === trade.swap
      ) {
        return trade;
      }

      return {
        ...trade,
        profit: convertedProfit,
        netPnl: convertedNetPnl,
        commissions: convertedCommissions,
        swap: convertedSwap,
      };
    });
  }, [accountCurrencyById, accountId, query.data, resolvedCurrencyCode]);

  return {
    ...query,
    trades,
  };
}
