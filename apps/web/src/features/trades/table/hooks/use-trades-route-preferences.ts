"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

export type TradeSummaryMetricId =
  | "scope"
  | "trades"
  | "outcome"
  | "grossPnl"
  | "netPnl"
  | "winRate"
  | "avgRR"
  | "profitFactor"
  | "expectancy"
  | "bestTrade"
  | "worstTrade"
  | "streak"
  | "volume";

export type TradeFilterPreset = {
  id: string;
  name: string;
  params: Record<string, string | null>;
};

export type TradesRoutePreferences = {
  filterPresets?: TradeFilterPreset[];
  summaryMetrics?: TradeSummaryMetricId[];
  viewMode?: "table" | "list";
};

const TRADES_TABLE_ID = "trades";
const DEFAULT_SUMMARY_METRICS: TradeSummaryMetricId[] = [
  "scope",
  "trades",
  "grossPnl",
  "winRate",
  "avgRR",
  "profitFactor",
  "expectancy",
  "streak",
  "volume",
];

function normalizePreferences(value: unknown): TradesRoutePreferences {
  if (!value || typeof value !== "object") {
    return {};
  }

  const raw = value as TradesRoutePreferences;
  return {
    filterPresets: Array.isArray(raw.filterPresets) ? raw.filterPresets : [],
    summaryMetrics: Array.isArray(raw.summaryMetrics)
      ? raw.summaryMetrics
      : DEFAULT_SUMMARY_METRICS,
    viewMode: raw.viewMode === "list" ? "list" : "table",
  };
}

export function useTradesRoutePreferences() {
  const preferencesQuery = useQuery({
    ...trpcOptions.users.getTablePreferences.queryOptions({
      tableId: TRADES_TABLE_ID,
    }),
    staleTime: 60_000,
  });

  const preferences = React.useMemo(
    () => normalizePreferences(preferencesQuery.data),
    [preferencesQuery.data]
  );

  const updateMutation = useMutation({
    mutationFn: async (updates: TradesRoutePreferences) =>
      trpcClient.users.updateTablePreferences.mutate({
        tableId: TRADES_TABLE_ID,
        preferences: updates,
      }),
    onSuccess: async (_result, updates) => {
      const queryKey = trpcOptions.users.getTablePreferences.queryOptions({
        tableId: TRADES_TABLE_ID,
      }).queryKey;

      queryClient.setQueryData(queryKey, (current: unknown) => ({
        ...normalizePreferences(current),
        ...updates,
      }));
    },
  });

  const updatePreferences = React.useCallback(
    async (updates: TradesRoutePreferences) => {
      await updateMutation.mutateAsync(updates);
    },
    [updateMutation]
  );

  return {
    defaultSummaryMetrics: DEFAULT_SUMMARY_METRICS,
    filterPresets: preferences.filterPresets ?? [],
    isSaving: updateMutation.isPending,
    summaryMetrics: preferences.summaryMetrics ?? DEFAULT_SUMMARY_METRICS,
    updatePreferences,
    viewMode: preferences.viewMode ?? "table",
  };
}
