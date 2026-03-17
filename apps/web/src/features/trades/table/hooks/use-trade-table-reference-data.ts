"use client";

import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { queryClient, trpcOptions } from "@/utils/trpc";

import type {
  AccountOpenBounds,
  AccountStatsSummary,
  AdvancedMetricsPreferences,
  NamedColorTag,
  NumericRange,
  SampleGateStatusRow,
} from "../lib/trade-table-view-state";
import type { TradeRow } from "../lib/trade-table-types";
import { NO_RESULTS_FILTER_ID } from "../lib/trade-table-view-state";

type ServerFilterArgs = {
  ids: string[];
  q: string;
  killzones: string[];
  effectiveTradeDirection: "all" | "long" | "short";
  effectiveSymbols: string[];
  effectiveSessionTags: string[];
  effectiveModelTags: string[];
  effectiveProtocolAlignments: string[];
  effectiveClosedOutcomes: string[];
  mergedDateRange: { start?: Date; end?: Date };
  hasMergedFilterConflict: boolean;
  onlyLiveOutcomeSelected: boolean;
  effectiveHoldRange?: NumericRange;
  effectiveVolRange?: NumericRange;
  effectivePlRange?: NumericRange;
  effectiveComRange?: NumericRange;
  effectiveSwapRange?: NumericRange;
  effectiveSlRange?: NumericRange;
  effectiveTpRange?: NumericRange;
  effectiveRrRange?: NumericRange;
  effectiveMfeRange?: NumericRange;
  effectiveMaeRange?: NumericRange;
  effectiveEfficiencyRange?: NumericRange;
};

type UseTradeTableReferenceDataArgs = {
  accountId: string | null;
  filters: ServerFilterArgs;
};

export function useTradeTableReferenceData({
  accountId,
  filters,
}: UseTradeTableReferenceDataArgs) {
  const advancedPrefsQuery =
    trpcOptions.users.getAdvancedMetricsPreferences.queryOptions();
  const { data: advancedPrefsRaw, isLoading: isLoadingAdvancedPrefs } = useQuery({
    ...advancedPrefsQuery,
    staleTime: 0,
    refetchOnMount: true,
  });
  const advancedPrefs = advancedPrefsRaw as
    | AdvancedMetricsPreferences
    | undefined;
  const disableSampleGating = advancedPrefs?.disableSampleGating;

  React.useEffect(() => {
    if (disableSampleGating === undefined) return;
    queryClient.invalidateQueries({ queryKey: [["trades"]] });
  }, [disableSampleGating]);

  const boundsOpts = trpcOptions.accounts.opensBounds.queryOptions({
    accountId: accountId || "",
  });
  const { data: boundsRaw, isLoading: isLoadingBounds } = useQuery({
    ...boundsOpts,
    enabled: Boolean(accountId),
  });
  const bounds = boundsRaw as AccountOpenBounds | undefined;
  const minBound = bounds?.minISO ? new Date(bounds.minISO) : undefined;
  const maxBound = bounds?.maxISO ? new Date(bounds.maxISO) : undefined;

  const symbolsOpts = trpcOptions.trades.listSymbols.queryOptions({
    accountId: accountId || "",
  });
  const { data: allSymbolsRaw, isLoading: isLoadingSymbols } = useQuery({
    ...symbolsOpts,
    enabled: Boolean(accountId),
  });
  const allSymbols = React.useMemo(
    () => (allSymbolsRaw as string[] | undefined) ?? [],
    [allSymbolsRaw]
  );

  const killzonesOpts = trpcOptions.trades.listKillzones.queryOptions({
    accountId: accountId || "",
  });
  const { data: allKillzonesRaw, isLoading: isLoadingKillzones } = useQuery({
    ...killzonesOpts,
    enabled: Boolean(accountId),
  });
  const allKillzones = React.useMemo(
    () => (allKillzonesRaw as NamedColorTag[] | undefined) ?? [],
    [allKillzonesRaw]
  );

  const sessionTagsOpts = trpcOptions.trades.listSessionTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: allSessionTagsRaw, isLoading: isLoadingSessionTags } = useQuery({
    ...sessionTagsOpts,
    enabled: Boolean(accountId),
  });
  const allSessionTags = React.useMemo(
    () => (allSessionTagsRaw as NamedColorTag[] | undefined) ?? [],
    [allSessionTagsRaw]
  );

  const modelTagsOpts = trpcOptions.trades.listModelTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: allModelTagsRaw, isLoading: isLoadingModelTags } = useQuery({
    ...modelTagsOpts,
    enabled: Boolean(accountId),
  });
  const allModelTags = React.useMemo(
    () => (allModelTagsRaw as NamedColorTag[] | undefined) ?? [],
    [allModelTagsRaw]
  );

  const statsOpts = trpcOptions.accounts.stats.queryOptions({
    accountId: accountId || "",
  });
  const { data: acctStatsRaw, isLoading: isLoadingStats } = useQuery({
    ...statsOpts,
    enabled: Boolean(accountId),
  });
  const acctStats = acctStatsRaw as AccountStatsSummary | undefined;

  const liveMetricsOpts = trpcOptions.accounts.liveMetrics.queryOptions({
    accountId: accountId || "",
  });
  const { data: liveMetrics } = useQuery({
    ...liveMetricsOpts,
    enabled: Boolean(accountId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
  const liveOpenTrades = React.useMemo(
    () =>
      (
        liveMetrics as
          | {
              openTrades?: Array<{
                accountId?: string | null;
                ticket?: string | null;
                id?: string | null;
                openTime?: string | null;
                symbol?: string | null;
                tradeType?: string | null;
                volume?: number | null;
                profit?: number | null;
                commission?: number | null;
                swap?: number | null;
                tp?: number | null;
                sl?: number | null;
                openPrice?: number | null;
                currentPrice?: number | null;
                sessionTag?: string | null;
                sessionTagColor?: string | null;
                slModCount?: number | null;
                tpModCount?: number | null;
                partialCloseCount?: number | null;
                exitDealCount?: number | null;
                exitVolume?: number | null;
                entryDealCount?: number | null;
                entryVolume?: number | null;
                scaleInCount?: number | null;
                scaleOutCount?: number | null;
                trailingStopDetected?: boolean | null;
              }>;
            }
          | undefined
      )?.openTrades ?? [],
    [liveMetrics]
  );

  const liveTradeSignature = React.useMemo(
    () =>
      liveOpenTrades
        .map((trade) => `${trade.accountId ?? ""}:${trade.ticket ?? trade.id ?? ""}`)
        .filter(Boolean)
        .sort()
        .join("|"),
    [liveOpenTrades]
  );
  const lastLiveTradeSignatureRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!accountId) {
      lastLiveTradeSignatureRef.current = null;
      return;
    }

    const nextSignature = `${accountId}:${liveTradeSignature}`;
    const previousSignature = lastLiveTradeSignatureRef.current;
    lastLiveTradeSignatureRef.current = nextSignature;

    if (previousSignature === null || previousSignature === nextSignature) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: [["trades"]] });
    queryClient.refetchQueries({ queryKey: [["trades"]], type: "active" });
  }, [accountId, liveTradeSignature]);

  const sampleGateOpts = trpcOptions.trades.getSampleGateStatus.queryOptions({
    accountId: accountId || "",
  });
  const { data: sampleGateStatusRaw, isLoading: isLoadingSampleGate } = useQuery({
    ...sampleGateOpts,
    enabled: Boolean(accountId),
  });
  const sampleGateStatus = sampleGateStatusRaw as
    | SampleGateStatusRow[]
    | undefined;

  const infiniteOpts = trpcOptions.trades.listInfinite.infiniteQueryOptions(
    {
      accountId: accountId || "",
      limit: filters.ids.length ? Math.min(Math.max(filters.ids.length, 50), 200) : 50,
      q: filters.q || undefined,
      tradeDirection:
        filters.effectiveTradeDirection === "all"
          ? undefined
          : filters.effectiveTradeDirection,
      ids:
        filters.hasMergedFilterConflict || filters.onlyLiveOutcomeSelected
          ? [NO_RESULTS_FILTER_ID]
          : filters.ids,
      symbols: filters.effectiveSymbols.length ? filters.effectiveSymbols : undefined,
      killzones: filters.killzones.length ? filters.killzones : undefined,
      sessionTags: filters.effectiveSessionTags.length
        ? filters.effectiveSessionTags
        : undefined,
      modelTags: filters.effectiveModelTags.length
        ? filters.effectiveModelTags
        : undefined,
      protocolAlignment: filters.effectiveProtocolAlignments.length
        ? (filters.effectiveProtocolAlignments as any)
        : undefined,
      outcomes: filters.effectiveClosedOutcomes.length
        ? (filters.effectiveClosedOutcomes as any)
        : undefined,
      startISO: filters.mergedDateRange.start?.toISOString(),
      endISO: filters.mergedDateRange.end?.toISOString(),
      holdMin:
        filters.effectiveHoldRange && Number.isFinite(filters.effectiveHoldRange[0])
          ? filters.effectiveHoldRange[0]
          : undefined,
      holdMax:
        filters.effectiveHoldRange && Number.isFinite(filters.effectiveHoldRange[1])
          ? filters.effectiveHoldRange[1]
          : undefined,
      volumeMin:
        filters.effectiveVolRange && Number.isFinite(filters.effectiveVolRange[0])
          ? filters.effectiveVolRange[0]
          : undefined,
      volumeMax:
        filters.effectiveVolRange && Number.isFinite(filters.effectiveVolRange[1])
          ? filters.effectiveVolRange[1]
          : undefined,
      profitMin:
        filters.effectivePlRange && Number.isFinite(filters.effectivePlRange[0])
          ? filters.effectivePlRange[0]
          : undefined,
      profitMax:
        filters.effectivePlRange && Number.isFinite(filters.effectivePlRange[1])
          ? filters.effectivePlRange[1]
          : undefined,
      commissionsMin:
        filters.effectiveComRange && Number.isFinite(filters.effectiveComRange[0])
          ? filters.effectiveComRange[0]
          : undefined,
      commissionsMax:
        filters.effectiveComRange && Number.isFinite(filters.effectiveComRange[1])
          ? filters.effectiveComRange[1]
          : undefined,
      swapMin:
        filters.effectiveSwapRange && Number.isFinite(filters.effectiveSwapRange[0])
          ? filters.effectiveSwapRange[0]
          : undefined,
      swapMax:
        filters.effectiveSwapRange && Number.isFinite(filters.effectiveSwapRange[1])
          ? filters.effectiveSwapRange[1]
          : undefined,
      slMin:
        filters.effectiveSlRange && Number.isFinite(filters.effectiveSlRange[0])
          ? filters.effectiveSlRange[0]
          : undefined,
      slMax:
        filters.effectiveSlRange && Number.isFinite(filters.effectiveSlRange[1])
          ? filters.effectiveSlRange[1]
          : undefined,
      tpMin:
        filters.effectiveTpRange && Number.isFinite(filters.effectiveTpRange[0])
          ? filters.effectiveTpRange[0]
          : undefined,
      tpMax:
        filters.effectiveTpRange && Number.isFinite(filters.effectiveTpRange[1])
          ? filters.effectiveTpRange[1]
          : undefined,
      rrMin:
        filters.effectiveRrRange && Number.isFinite(filters.effectiveRrRange[0])
          ? filters.effectiveRrRange[0]
          : undefined,
      rrMax:
        filters.effectiveRrRange && Number.isFinite(filters.effectiveRrRange[1])
          ? filters.effectiveRrRange[1]
          : undefined,
      mfeMin:
        filters.effectiveMfeRange && Number.isFinite(filters.effectiveMfeRange[0])
          ? filters.effectiveMfeRange[0]
          : undefined,
      mfeMax:
        filters.effectiveMfeRange && Number.isFinite(filters.effectiveMfeRange[1])
          ? filters.effectiveMfeRange[1]
          : undefined,
      maeMin:
        filters.effectiveMaeRange && Number.isFinite(filters.effectiveMaeRange[0])
          ? filters.effectiveMaeRange[0]
          : undefined,
      maeMax:
        filters.effectiveMaeRange && Number.isFinite(filters.effectiveMaeRange[1])
          ? filters.effectiveMaeRange[1]
          : undefined,
      efficiencyMin:
        filters.effectiveEfficiencyRange &&
        Number.isFinite(filters.effectiveEfficiencyRange[0])
          ? filters.effectiveEfficiencyRange[0]
          : undefined,
      efficiencyMax:
        filters.effectiveEfficiencyRange &&
        Number.isFinite(filters.effectiveEfficiencyRange[1])
          ? filters.effectiveEfficiencyRange[1]
          : undefined,
    },
    { getNextPageParam: (last: any) => last?.nextCursor }
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({ ...infiniteOpts, enabled: Boolean(accountId) });

  const rows = React.useMemo<TradeRow[]>(() => {
    const pages = (data as any)?.pages as Array<{ items: TradeRow[] }> | undefined;
    if (!pages) return [];
    return pages.flatMap((page) => page.items);
  }, [data]);

  const liveRows = React.useMemo<TradeRow[]>(() => {
    const now = Date.now();
    return liveOpenTrades.map((trade) => {
      const openTimeISO = trade.openTime;
      const openMs = Date.parse(openTimeISO ?? "");
      const holdSeconds = Number.isNaN(openMs)
        ? 0
        : Math.max(0, Math.floor((now - openMs) / 1000));
      return {
        id: trade.id ?? "",
        ticket: trade.ticket ?? null,
        symbol: trade.symbol ?? "",
        rawSymbol: trade.symbol ?? "",
        symbolGroup: trade.symbol ?? "",
        tradeDirection: trade.tradeType === "short" ? "short" : "long",
        volume: trade.volume ?? 0,
        profit: trade.profit ?? 0,
        commissions: trade.commission ?? 0,
        swap: trade.swap ?? 0,
        tp: trade.tp ?? 0,
        sl: trade.sl ?? 0,
        open: openTimeISO ?? new Date().toISOString(),
        close: new Date().toISOString(),
        closeText: "Live",
        createdAtISO: openTimeISO ?? new Date().toISOString(),
        holdSeconds,
        openPrice: trade.openPrice ?? null,
        closePrice: trade.currentPrice ?? null,
        sessionTag: trade.sessionTag ?? null,
        sessionTagColor: trade.sessionTagColor ?? null,
        slModCount: trade.slModCount,
        tpModCount: trade.tpModCount,
        partialCloseCount: trade.partialCloseCount,
        exitDealCount: trade.exitDealCount,
        exitVolume: trade.exitVolume,
        entryDealCount: trade.entryDealCount,
        entryVolume: trade.entryVolume,
        scaleInCount: trade.scaleInCount,
        scaleOutCount: trade.scaleOutCount,
        trailingStopDetected: trade.trailingStopDetected,
        complianceStatus: "unknown",
        complianceFlags: [],
        isLive: true,
      };
    });
  }, [liveOpenTrades]);

  const baseRows = React.useMemo<TradeRow[]>(
    () => [...liveRows, ...rows],
    [liveRows, rows]
  );

  const totalTradesCount = React.useMemo(() => {
    const pages = (data as any)?.pages as Array<{ totalTradesCount?: number }> | undefined;
    return pages?.[0]?.totalTradesCount ?? 0;
  }, [data]);

  const isWorkspaceLoading = Boolean(accountId) && (
    isLoadingAdvancedPrefs ||
    isLoadingBounds ||
    isLoadingSymbols ||
    isLoadingKillzones ||
    isLoadingSessionTags ||
    isLoadingModelTags ||
    isLoadingStats ||
    isLoadingSampleGate ||
    isLoading
  );

  return {
    acctStats,
    allKillzones,
    allModelTags,
    allSessionTags,
    allSymbols,
    baseRows,
    disableSampleGating,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isWorkspaceLoading,
    maxBound,
    minBound,
    sampleGateStatus,
    totalTradesCount,
  };
}
