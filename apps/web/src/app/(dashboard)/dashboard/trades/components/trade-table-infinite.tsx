"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/index";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { useDataTable } from "@/hooks/use-data-table";
import { useAccountStore } from "@/stores/account";
import TradesToolbar from "@/features/trades/table-toolbar/components/trades-toolbar";
import { TradeFiltersProvider } from "@/features/trades/table-toolbar/lib/trade-filters-context";
import { useQueryState } from "nuqs";
import { SampleGateBanner } from "@/components/sample-gate-banner";
import { PerformanceSummaryBar } from "@/components/trades/performance-summary-bar";
import { useDragSelect } from "@/hooks/use-drag-select";
import { BulkActionsToolbar } from "@/features/trades/bulk-actions/components/bulk-actions-toolbar";
import { TradeTableEmptyState } from "@/features/trades/table/components/trade-table-empty-state";
import { TradeTableGroupHeader } from "@/features/trades/table/components/trade-table-group-header";
import { tradeTableColumns } from "@/features/trades/table/lib/trade-table-columns";
import {
  buildTradeTableColumnVisibility,
  buildTradeTableInitialSizing,
} from "@/features/trades/table/lib/trade-table-column-state";
import {
  getTradeTableGroupKey,
  type TradeTableGroupBy,
} from "@/features/trades/table/lib/trade-table-grouping";
import { getTradeRiskUnit } from "@/features/trades/table/lib/trade-table-pnl-display";
import { useTradeDrawdownMap } from "@/features/trades/table/hooks/use-trade-drawdown-map";
import { useTradeTableFilteredData } from "@/features/trades/table/hooks/use-trade-table-filtered-data";
import { useTradeTableFilterControls } from "@/features/trades/table/hooks/use-trade-table-filter-controls";
import { useTradeTableReferenceData } from "@/features/trades/table/hooks/use-trade-table-reference-data";
import {
  applyInlineTradeUpdateToQueryData,
  getInlineTradeUpdateField,
  getInlineTradeUpdateFieldLabel,
} from "@/features/trades/table/lib/trade-table-optimistic-updates";
import { summarizeTradeRows } from "@/features/trades/table/lib/trade-table-summary";
import type { NumericRange } from "@/features/trades/table/lib/trade-table-view-state";
import {
  serializeDecimalRange,
  serializeIntegerRange,
} from "@/features/trades/table/lib/trade-table-query-state";
import { queryClient, trpcClient } from "@/utils/trpc";
import { useTradeKeyboardShortcuts } from "@/hooks/use-trade-keyboard-shortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import { exportTradesToCSV } from "@/lib/export-trades";
import type {
  InlineTradeUpdateInput,
  TradePnlDisplayMode,
  TradeRow,
} from "@/features/trades/table/lib/trade-table-types";
import {
  type TradeFilterPreset,
  useTradesRoutePreferences,
} from "@/features/trades/table/hooks/use-trades-route-preferences";
import { TradeTableMobileList } from "./trade-table-mobile-list";
import {
  createTradeTableOrchestrationState,
  tradeTableOrchestrationReducer,
} from "./trade-table-orchestration";
import { TradeTablePagination } from "./trade-table-pagination";
import { TradeTableSheets } from "./trade-table-sheets";
import { TradeTableUtilityBar } from "./trade-table-utility-bar";

export default function TradeTableInfinite() {
  const accountId = useAccountStore((s) => s.selectedAccountId) ?? null;

  if (!accountId) {
    return (
      <RouteLoadingFallback
        route="trades"
        className="min-h-[calc(100vh-10rem)]"
      />
    );
  }

  return <TradeTableInfiniteContent accountId={accountId} />;
}

const TRADE_TABLE_PAGE_SIZE = 10;
const INLINE_TRADE_UPDATE_DEBOUNCE_MS = 150;

function TradeTableInfiniteContent({ accountId }: { accountId: string }) {
  const {
    q,
    idsParam,
    slParam,
    tpParam,
    dirParam,
    symbolsParam,
    killzonesParam,
    sessionTagsParam,
    modelTagsParam,
    protocolParam,
    outcomeParam,
    holdParam,
    volParam,
    plParam,
    comParam,
    swapParam,
    rrParam,
    mfeParam,
    maeParam,
    effParam,
    sortParam,
    viewParam,
    oStart,
    oEnd,
    filterState,
    selectedViewVisibleColumns,
    statFilters,
    setStatFilters,
    setQParam,
    setIdsParam,
    setSlParam,
    setTpParam,
    setDirParam,
    setSymbolsParam,
    setKillzonesParam,
    setSessionTagsParam,
    setModelTagsParam,
    setProtocolParam,
    setOutcomeParam,
    setHoldParam,
    setVolParam,
    setPlParam,
    setComParam,
    setSwapParam,
    setRrParam,
    setMfeParam,
    setMaeParam,
    setEffParam,
    setSortParam,
    setViewParam,
    setRangeParams,
  } = useTradeTableFilterControls();
  const {
    ids,
    tradeDirection,
    symbols,
    killzones,
    sessionTags,
    modelTags,
    protocolAlignments,
    outcomes,
    start,
    end,
    holdRange,
    volRange,
    rawPlRange,
    rawComRange,
    rawSwapRange,
    rrRange,
    mfeRange,
    maeRange,
    efficiencyRange,
    mergedDateRange,
    hasMergedFilterConflict,
    effectiveTradeDirection,
    effectiveSymbols,
    effectiveSessionTags,
    effectiveModelTags,
    effectiveProtocolAlignments,
    effectiveOutcomes,
    effectiveClosedOutcomes,
    onlyLiveOutcomeSelected,
    effectiveHoldRange,
    effectiveVolRange,
    effectivePlRange,
    effectiveComRange,
    effectiveSwapRange,
    effectiveSlRange,
    effectiveTpRange,
    effectiveRrRange,
    effectiveMfeRange,
    effectiveMaeRange,
    effectiveEfficiencyRange,
  } = filterState;
  const {
    filterPresets,
    summaryMetrics,
    updatePreferences,
    viewMode: preferredViewMode,
  } = useTradesRoutePreferences();
  const isMobile = useIsMobile();
  const [orchestrationState, dispatch] = React.useReducer(
    tradeTableOrchestrationReducer,
    preferredViewMode,
    createTradeTableOrchestrationState
  );
  const manageViewsOpen = orchestrationState.manageViewsOpen;
  const focusedTradeId = orchestrationState.focusedTradeId;
  const viewMode = orchestrationState.viewMode;

  React.useEffect(() => {
    dispatch({ type: "setViewMode", viewMode: preferredViewMode });
  }, [preferredViewMode]);

  const {
    acctStats,
    allKillzones,
    allCustomTags,
    allModelTags,
    allSessionTags,
    allSymbols,
    closedRows,
    disableSampleGating,
    fetchNextPage,
    filteredTradesCount,
    filterArtifacts,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    liveRows,
    maxBound,
    minBound,
    sampleGateStatus,
    totalTradesCount,
  } = useTradeTableReferenceData({
    accountId,
    filters: {
      ids,
      q,
      killzones,
      effectiveTradeDirection,
      effectiveSymbols,
      effectiveSessionTags,
      effectiveModelTags,
      effectiveProtocolAlignments,
      effectiveClosedOutcomes,
      mergedDateRange,
      hasMergedFilterConflict,
      onlyLiveOutcomeSelected,
      effectiveHoldRange: effectiveHoldRange as NumericRange | undefined,
      effectiveVolRange: effectiveVolRange as NumericRange | undefined,
      effectivePlRange: effectivePlRange as NumericRange | undefined,
      effectiveComRange: effectiveComRange as NumericRange | undefined,
      effectiveSwapRange: effectiveSwapRange as NumericRange | undefined,
      effectiveSlRange: effectiveSlRange as NumericRange | undefined,
      effectiveTpRange: effectiveTpRange as NumericRange | undefined,
      effectiveRrRange: effectiveRrRange as NumericRange | undefined,
      effectiveMfeRange: effectiveMfeRange as NumericRange | undefined,
      effectiveMaeRange: effectiveMaeRange as NumericRange | undefined,
      effectiveEfficiencyRange: effectiveEfficiencyRange as
        | NumericRange
        | undefined,
    },
  });

  const [pnlMode, setPnlMode] = useQueryState("pnl", {
    defaultValue: "usd",
  });
  const [ddMode, setDdMode] = useQueryState("dd", { defaultValue: "percent" });
  const groupBy = orchestrationState.groupBy;
  const baselineInitialBalance = acctStats?.initialBalance;
  const canShowRRPnl = getTradeRiskUnit(baselineInitialBalance) != null;
  const tradePnlMode: TradePnlDisplayMode =
    pnlMode === "rr" && canShowRRPnl ? "rr" : "usd";
  const tradeDdMode =
    ddMode === "pips" || ddMode === "usd" ? ddMode : "percent";
  const {
    commissionsHistogram,
    displayRows,
    efficiencyHistogram,
    holdHistogram,
    maeHistogram,
    mfeHistogram,
    profitHistogram,
    rrHistogram,
    streakByTradeId,
    swapHistogram,
    symbolCounts,
    symbolTotal,
    volumeHistogram,
  } = useTradeTableFilteredData({
    closedRows,
    liveRows,
    filterArtifacts,
    ids,
    q,
    killzones,
    effectiveTradeDirection,
    effectiveSymbols,
    effectiveSessionTags,
    effectiveModelTags,
    effectiveProtocolAlignments,
    effectiveOutcomes,
    mergedDateRange,
    effectiveHoldRange: effectiveHoldRange as NumericRange | undefined,
    effectiveVolRange: effectiveVolRange as NumericRange | undefined,
    effectivePlRange: effectivePlRange as NumericRange | undefined,
    effectiveComRange: effectiveComRange as NumericRange | undefined,
    effectiveSwapRange: effectiveSwapRange as NumericRange | undefined,
    effectiveSlRange: effectiveSlRange as NumericRange | undefined,
    effectiveTpRange: effectiveTpRange as NumericRange | undefined,
    effectiveRrRange: effectiveRrRange as NumericRange | undefined,
    effectiveMfeRange: effectiveMfeRange as NumericRange | undefined,
    effectiveMaeRange: effectiveMaeRange as NumericRange | undefined,
    effectiveEfficiencyRange: effectiveEfficiencyRange as
      | NumericRange
      | undefined,
    hasMergedFilterConflict,
  });
  const displayRowById = React.useMemo(
    () => new Map(displayRows.map((trade) => [trade.id, trade])),
    [displayRows]
  );
  const [renderedTradeIds, setRenderedTradeIds] = React.useState<string[]>([]);
  const drawdownVisibleRows = React.useMemo(() => {
    if (!renderedTradeIds.length) {
      return [] as string[];
    }

    return renderedTradeIds.filter((tradeId) => {
      const trade = displayRowById.get(tradeId);
      return Boolean(trade && !trade.isLive);
    });
  }, [displayRowById, renderedTradeIds]);
  const { drawdownByTradeId, isLoading: isDrawdownLoading } =
    useTradeDrawdownMap({
      tradeIds: drawdownVisibleRows,
    });

  const [savingCellKeys, setSavingCellKeys] = React.useState<Record<string, true>>(
    {}
  );
  const pendingInlineUpdatesRef = React.useRef(
    new Map<
      string,
      {
        input: InlineTradeUpdateInput;
        rejectors: Array<(error: unknown) => void>;
        resolvers: Array<() => void>;
        timeoutId: number;
      }
    >()
  );

  const addSavingCell = React.useCallback((cellKey: string | null) => {
    if (!cellKey) {
      return;
    }

    setSavingCellKeys((current) => {
      if (current[cellKey]) {
        return current;
      }

      return { ...current, [cellKey]: true };
    });
  }, []);

  const removeSavingCell = React.useCallback((cellKey: string | null) => {
    if (!cellKey) {
      return;
    }

    setSavingCellKeys((current) => {
      if (!current[cellKey]) {
        return current;
      }

      const next = { ...current };
      delete next[cellKey];
      return next;
    });
  }, []);

  const isCellSaving = React.useCallback(
    (tradeId: string, field: Exclude<keyof InlineTradeUpdateInput, "tradeId">) =>
      Boolean(savingCellKeys[`${tradeId}:${field}`]),
    [savingCellKeys]
  );

  const updateTradeMutation = useMutation({
    mutationFn: async (input: InlineTradeUpdateInput) =>
      trpcClient.trades.update.mutate(input),
    onMutate: async (input) => {
      const field = getInlineTradeUpdateField(input);
      const cellKey = field ? `${input.tradeId}:${field}` : null;

      addSavingCell(cellKey);
      await queryClient.cancelQueries({ queryKey: [["trades"]] });

      const previousTradesQueries = queryClient.getQueriesData({
        queryKey: [["trades"]],
      });

      previousTradesQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(
          queryKey,
          applyInlineTradeUpdateToQueryData(data, input)
        );
      });

      return { cellKey, field, previousTradesQueries };
    },
    onError: (error, _input, context) => {
      context?.previousTradesQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });

      console.error("Inline trade update failed:", error);
      toast.error(
        `Couldn't update ${getInlineTradeUpdateFieldLabel(context?.field ?? null)}.`
      );
    },
    onSettled: (_data, _error, _input, context) => {
      removeSavingCell(context?.cellKey ?? null);
      void queryClient.invalidateQueries({ queryKey: [["trades"]] });
    },
  });

  const flushPendingInlineTradeUpdate = React.useCallback(
    async (key: string) => {
      const pending = pendingInlineUpdatesRef.current.get(key);
      if (!pending) {
        return;
      }

      pendingInlineUpdatesRef.current.delete(key);

      try {
        await updateTradeMutation.mutateAsync(pending.input);
        pending.resolvers.forEach((resolve) => resolve());
      } catch (error) {
        pending.rejectors.forEach((reject) => reject(error));
      }
    },
    [updateTradeMutation]
  );

  React.useEffect(() => {
    return () => {
      pendingInlineUpdatesRef.current.forEach((pending) => {
        window.clearTimeout(pending.timeoutId);
      });
      pendingInlineUpdatesRef.current.clear();
    };
  }, []);

  const handleInlineTradeUpdate = React.useCallback(
    (input: InlineTradeUpdateInput) => {
      const field = getInlineTradeUpdateField(input);
      if (!field) {
        return updateTradeMutation.mutateAsync(input);
      }

      const pendingKey = `${input.tradeId}:${field}`;

      return new Promise<void>((resolve, reject) => {
        const existing = pendingInlineUpdatesRef.current.get(pendingKey);
        if (existing) {
          window.clearTimeout(existing.timeoutId);
          existing.input = input;
          existing.resolvers.push(resolve);
          existing.rejectors.push(reject);
          existing.timeoutId = window.setTimeout(() => {
            void flushPendingInlineTradeUpdate(pendingKey);
          }, INLINE_TRADE_UPDATE_DEBOUNCE_MS);
          return;
        }

        pendingInlineUpdatesRef.current.set(pendingKey, {
          input,
          rejectors: [reject],
          resolvers: [resolve],
          timeoutId: window.setTimeout(() => {
            void flushPendingInlineTradeUpdate(pendingKey);
          }, INLINE_TRADE_UPDATE_DEBOUNCE_MS),
        });
      });
    },
    [flushPendingInlineTradeUpdate, updateTradeMutation]
  );

  const initialVisibility = React.useMemo(
    () =>
      viewParam
        ? buildTradeTableColumnVisibility(viewParam, selectedViewVisibleColumns)
        : undefined,
    [selectedViewVisibleColumns, viewParam]
  );
  const initialSizing = React.useMemo(() => buildTradeTableInitialSizing(), []);

  const { table, sorting, setSorting, setColumnVisibility, setRowSelection } =
    useDataTable<TradeRow>({
      data: displayRows,
      columns: tradeTableColumns,
      tableId: "trades",
      initialPageSize: TRADE_TABLE_PAGE_SIZE,
      disablePreferences: Boolean(viewParam),
      meta: {
        totalTradesCount,
        disableSampleGating,
        pnlMode: tradePnlMode,
        baselineInitialBalance,
        streakByTradeId,
        sessionTags: allSessionTags,
        modelTags: allModelTags,
        customTags: allCustomTags,
        drawdownByTradeId,
        drawdownLoading: isDrawdownLoading,
        isCellSaving,
        updateTrade: handleInlineTradeUpdate,
      },
      initialVisibility,
      initialSizing,
      getRowId: (row) => row.id, // Use trade ID as row ID
      enableFilteringRowModel: false,
      enablePaginationRowModel: true,
      enableColumnResizing: false,
    });
  const isDrawdownVisible =
    table.getColumn("drawdown")?.getIsVisible() ?? false;

  React.useEffect(() => {
    if (!isDrawdownVisible && renderedTradeIds.length > 0) {
      setRenderedTradeIds([]);
    }
  }, [isDrawdownVisible, renderedTradeIds.length]);

  const paginationState = table.getState().pagination;
  const pageIndex = paginationState.pageIndex;
  const pageSize = paginationState.pageSize;
  const currentPageRows = table.getRowModel().rows.length;
  const loadedPageCount = table.getPageCount();
  const pageStart = displayRows.length === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd =
    displayRows.length === 0
      ? 0
      : Math.min(pageStart + currentPageRows - 1, displayRows.length);

  React.useEffect(() => {
    const maxPageIndex = Math.max(loadedPageCount - 1, 0);
    if (pageIndex <= maxPageIndex) {
      return;
    }

    table.setPageIndex(maxPageIndex);
  }, [loadedPageCount, pageIndex, table]);

  // Update column visibility when view changes
  React.useEffect(() => {
    if (!viewParam) {
      return;
    }

    setColumnVisibility(
      buildTradeTableColumnVisibility(viewParam, selectedViewVisibleColumns)
    );
  }, [selectedViewVisibleColumns, setColumnVisibility, viewParam]);

  const openSheet = orchestrationState.detailOpen;
  const selectedTradeId = orchestrationState.selectedTradeId;
  const selectedTrade = React.useMemo(
    () => (selectedTradeId ? displayRowById.get(selectedTradeId) ?? null : null),
    [displayRowById, selectedTradeId]
  );
  const handleRowDoubleClick = React.useCallback((row: TradeRow) => {
    dispatch({ type: "openTrade", tradeId: row.id });
  }, []);

  // Apply URL sort to table (guard to avoid loops)
  React.useEffect(() => {
    const desired: { id: string; desc: boolean }[] = (sortParam || "open:desc")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [id, dir] = p.split(":");
        if (!id) return null as any;
        return { id, desc: dir === "desc" };
      })
      .filter(Boolean) as { id: string; desc: boolean }[];
    setSorting(desired as any);
  }, [sortParam, setSorting]);

  // Note: URL is updated by toolbar callbacks; no sorting->URL effect to avoid loops

  const handleDragSelectionChange = React.useCallback(
    (selectedTradeIds: Set<string>) => {
      const nextRowSelection: Record<string, boolean> = {};
      selectedTradeIds.forEach((tradeId) => {
        nextRowSelection[tradeId] = true;
      });
      setRowSelection(nextRowSelection);
    },
    [setRowSelection]
  );

  // Drag select functionality
  const dragSelect = useDragSelect({
    onSelectionChange: handleDragSelectionChange,
  });
  const clearDragSelection = dragSelect.clearSelection;

  React.useEffect(() => {
    setRowSelection({});
    clearDragSelection();
  }, [clearDragSelection, pageIndex, setRowSelection]);

  const handleNextPage = React.useCallback(async () => {
    if (pageIndex < loadedPageCount - 1) {
      table.nextPage();
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
      table.setPageIndex(loadedPageCount);
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    loadedPageCount,
    pageIndex,
    table,
  ]);

  // Get selected trade IDs from table selection
  const rowSelection = table.getState().rowSelection;
  const selectedTradeIds = React.useMemo(() => {
    // Keys in rowSelection are the actual trade IDs now
    return new Set(Object.keys(rowSelection).filter((id) => rowSelection[id]));
  }, [rowSelection]);
  const selectedTradeIdList = React.useMemo(
    () => Array.from(selectedTradeIds),
    [selectedTradeIds]
  );
  const selectedTrades = React.useMemo(() => {
    if (selectedTradeIdList.length === 0) {
      return [];
    }

    return selectedTradeIdList
      .map((tradeId) => displayRowById.get(tradeId))
      .filter((trade): trade is TradeRow => Boolean(trade));
  }, [displayRowById, selectedTradeIdList]);
  const singleSelectedTrade =
    selectedTradeIdList.length === 1 && selectedTrades.length === 1
      ? selectedTrades[0]
      : null;
  const currentPageTradeRows = React.useMemo(
    () => table.getRowModel().rows.map((row) => row.original),
    [table, pageIndex, displayRows]
  );
  const currentPageTradeIds = React.useMemo(
    () => currentPageTradeRows.map((row) => row.id),
    [currentPageTradeRows]
  );
  const deferredDisplayRows = React.useDeferredValue(displayRows);
  const summary = React.useMemo(
    () => summarizeTradeRows(deferredDisplayRows),
    [deferredDisplayRows]
  );
  const visibleColumnIds = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .filter((id) => id !== "select" && id !== "actions"),
    [table]
  );
  const activeSavingCount = React.useMemo(
    () => Object.keys(savingCellKeys).length,
    [savingCellKeys]
  );
  const filteredLiveRowsCount = Math.max(displayRows.length - closedRows.length, 0);
  const totalFilteredDisplayRows = filteredTradesCount + filteredLiveRowsCount;
  const showTopProgress =
    isFetchingNextPage || isDrawdownLoading || activeSavingCount > 0;
  const compareOpen = orchestrationState.compareOpen;
  const lastHandledIdsParamRef = React.useRef<string>("");

  const handleClearSelection = React.useCallback(() => {
    table.resetRowSelection();
    dragSelect.clearSelection();
    dispatch({ type: "setFocusedTradeId", tradeId: null });
  }, [dragSelect, table]);

  const handleOpenTrade = React.useCallback((trade: TradeRow) => {
    dispatch({ type: "openTrade", tradeId: trade.id });
  }, []);

  const handleToggleTradeSelection = React.useCallback(
    (tradeId: string) => {
      dispatch({ type: "setFocusedTradeId", tradeId });
      setRowSelection((current: Record<string, boolean>) => ({
        ...current,
        [tradeId]: !current[tradeId],
      }));
    },
    [setRowSelection]
  );

  const handleNavigateFocusedTrade = React.useCallback(
    (direction: -1 | 1) => {
      if (currentPageTradeIds.length === 0) {
        return;
      }

      const currentIndex = focusedTradeId
        ? currentPageTradeIds.indexOf(focusedTradeId)
        : -1;
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : currentPageTradeIds.length - 1
          : Math.min(
              currentPageTradeIds.length - 1,
              Math.max(0, currentIndex + direction)
            );
      dispatch({
        type: "setFocusedTradeId",
        tradeId: currentPageTradeIds[nextIndex] ?? null,
      });
    },
    [currentPageTradeIds, focusedTradeId]
  );

  const handleApplyPreset = React.useCallback(
    (preset: TradeFilterPreset) => {
      const params = preset.params;
      setQParam(params.q ?? null);
      setIdsParam(params.ids ?? null);
      setSlParam(params.sl ?? null);
      setTpParam(params.tp ?? null);
      setDirParam(params.dir ?? "all");
      setSymbolsParam(params.symbols ?? null);
      setKillzonesParam(params.killzones ?? null);
      setSessionTagsParam(params.sessionTags ?? null);
      setModelTagsParam(params.modelTags ?? null);
      setProtocolParam(params.protocol ?? null);
      setOutcomeParam(params.outcome ?? null);
      setHoldParam(params.hold ?? null);
      setVolParam(params.vol ?? null);
      setPlParam(params.pl ?? null);
      setComParam(params.com ?? null);
      setSwapParam(params.swap ?? null);
      setRrParam(params.rr ?? null);
      setMfeParam(params.mfe ?? null);
      setMaeParam(params.mae ?? null);
      setEffParam(params.eff ?? null);
      setSortParam(params.sort ?? "open:desc");
      setViewParam(params.view ?? null);
      setRangeParams({
        oEnd: params.oEnd ?? null,
        oStart: params.oStart ?? null,
      });
    },
    [
      setComParam,
      setDirParam,
      setEffParam,
      setHoldParam,
      setIdsParam,
      setKillzonesParam,
      setMaeParam,
      setMfeParam,
      setModelTagsParam,
      setOutcomeParam,
      setPlParam,
      setProtocolParam,
      setQParam,
      setRangeParams,
      setRrParam,
      setSessionTagsParam,
      setSlParam,
      setSortParam,
      setSwapParam,
      setSymbolsParam,
      setTpParam,
      setViewParam,
      setVolParam,
    ]
  );

  const handleSavePreset = React.useCallback(
    async (name: string) => {
      const nextPreset: TradeFilterPreset = {
        id: `preset_${Date.now()}`,
        name,
        params: {
          com: comParam || null,
          dir: dirParam !== "all" ? dirParam : null,
          eff: effParam || null,
          hold: holdParam || null,
          ids: idsParam || null,
          killzones: killzonesParam || null,
          mae: maeParam || null,
          mfe: mfeParam || null,
          modelTags: modelTagsParam || null,
          oEnd: oEnd || null,
          oStart: oStart || null,
          outcome: outcomeParam || null,
          pl: plParam || null,
          protocol: protocolParam || null,
          q: q || null,
          rr: rrParam || null,
          sessionTags: sessionTagsParam || null,
          sl: slParam || null,
          sort: sortParam || null,
          swap: swapParam || null,
          symbols: symbolsParam || null,
          tp: tpParam || null,
          view: viewParam || null,
          vol: volParam || null,
        },
      };

      await updatePreferences({
        filterPresets: [...filterPresets, nextPreset],
      });
      toast.success(`Saved preset "${name}"`);
    },
    [
      comParam,
      dirParam,
      effParam,
      filterPresets,
      holdParam,
      idsParam,
      killzonesParam,
      maeParam,
      mfeParam,
      modelTagsParam,
      oEnd,
      oStart,
      outcomeParam,
      plParam,
      protocolParam,
      q,
      rrParam,
      sessionTagsParam,
      slParam,
      sortParam,
      swapParam,
      symbolsParam,
      tpParam,
      updatePreferences,
      viewParam,
      volParam,
    ]
  );

  const handleDeletePreset = React.useCallback(
    async (presetId: string) => {
      await updatePreferences({
        filterPresets: filterPresets.filter((preset) => preset.id !== presetId),
      });
      toast.success("Preset removed");
    },
    [filterPresets, updatePreferences]
  );

  React.useEffect(() => {
    if (!focusedTradeId) {
      return;
    }

    if (!displayRowById.has(focusedTradeId)) {
      dispatch({ type: "setFocusedTradeId", tradeId: null });
    }
  }, [displayRowById, focusedTradeId]);

  useTradeKeyboardShortcuts(
    {
      onCompare:
        selectedTrades.length >= 2 && selectedTrades.length <= 4
          ? () => dispatch({ type: "setCompareOpen", open: true })
          : undefined,
      onCopy: async () => {
        const idsToCopy =
          selectedTradeIdList.length > 0
            ? selectedTradeIdList
            : focusedTradeId
            ? [focusedTradeId]
            : [];
        if (!idsToCopy.length) {
          return;
        }
        await navigator.clipboard.writeText(idsToCopy.join(", "));
        toast.success(
          idsToCopy.length === 1 ? "Trade ID copied" : "Trade IDs copied"
        );
      },
      onDeselectAll: handleClearSelection,
      onExport: () => {
        const rowsToExport =
          selectedTrades.length > 0 ? selectedTrades : currentPageTradeRows;
        if (!rowsToExport.length) {
          return;
        }
        exportTradesToCSV(
          rowsToExport,
          visibleColumnIds,
          Object.fromEntries(visibleColumnIds.map((column) => [column, column]))
        );
        toast.success(`Exported ${rowsToExport.length} trades`);
      },
      onNavigateDown: () => handleNavigateFocusedTrade(1),
      onNavigateUp: () => handleNavigateFocusedTrade(-1),
      onOpenDetails: () => {
        const targetTrade =
          (focusedTradeId ? displayRowById.get(focusedTradeId) : null) ??
          singleSelectedTrade;
        if (targetTrade) {
          handleOpenTrade(targetTrade);
        }
      },
      onSelectAll: () => {
        const nextRowSelection: Record<string, boolean> = {};
        currentPageTradeIds.forEach((id) => {
          nextRowSelection[id] = true;
        });
        setRowSelection(nextRowSelection);
      },
      onToggleSelection: () => {
        if (focusedTradeId) {
          handleToggleTradeSelection(focusedTradeId);
        }
      },
    },
    displayRows.length > 0
  );
  const hasResettableState =
    hasMergedFilterConflict ||
    Boolean(
      q ||
        idsParam ||
        slParam ||
        tpParam ||
        symbolsParam ||
        killzonesParam ||
        sessionTagsParam ||
        modelTagsParam ||
        protocolParam ||
        outcomeParam ||
        holdParam ||
        volParam ||
        plParam ||
        comParam ||
        swapParam ||
        rrParam ||
        mfeParam ||
        maeParam ||
        effParam ||
        oStart ||
        oEnd ||
        viewParam ||
        dirParam !== "all"
    );
  const activeEmptyStateFilters = React.useMemo(
    () =>
      [
        q ? `Search: ${q}` : null,
        tradeDirection !== "all" ? `Direction: ${tradeDirection}` : null,
        symbols.length ? `Symbols: ${symbols.slice(0, 2).join(", ")}` : null,
        sessionTags.length
          ? `Sessions: ${sessionTags.slice(0, 2).join(", ")}`
          : null,
        modelTags.length ? `Edge: ${modelTags.slice(0, 2).join(", ")}` : null,
        outcomes.length ? `Outcome: ${outcomes.slice(0, 2).join(", ")}` : null,
        start && end
          ? `Date: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
          : null,
      ].filter((value): value is string => Boolean(value)),
    [end, modelTags, outcomes, q, sessionTags, start, symbols, tradeDirection]
  );

  const handleResetTradeView = React.useCallback(() => {
    dispatch({ type: "resetForClear" });
    table.resetRowSelection();
    dragSelect.clearSelection();

    void Promise.all([
      setQParam(null),
      setIdsParam(null),
      setSlParam(null),
      setTpParam(null),
      setDirParam("all"),
      setSymbolsParam(null),
      setKillzonesParam(null),
      setSessionTagsParam(null),
      setModelTagsParam(null),
      setProtocolParam(null),
      setOutcomeParam(null),
      setHoldParam(null),
      setVolParam(null),
      setPlParam(null),
      setComParam(null),
      setSwapParam(null),
      setRrParam(null),
      setMfeParam(null),
      setMaeParam(null),
      setEffParam(null),
      setViewParam(null),
      setRangeParams({ oStart: null, oEnd: null }),
    ]);
  }, [
    dragSelect,
    setComParam,
    setDirParam,
    setEffParam,
    setHoldParam,
    setIdsParam,
    setKillzonesParam,
    setMaeParam,
    setMfeParam,
    setModelTagsParam,
    setOutcomeParam,
    setPlParam,
    setProtocolParam,
    setQParam,
    setRangeParams,
    setRrParam,
    setSessionTagsParam,
    setSlParam,
    setSwapParam,
    setSymbolsParam,
    setTpParam,
    setViewParam,
    setVolParam,
    table,
  ]);

  const emptyState = React.useMemo(() => {
    if (!accountId) {
      return (
        <TradeTableEmptyState
          title="Select an account"
          description="Choose a trading account to inspect trades, filters, and analytics."
        />
      );
    }

    if (isLoading) {
      return (
        <TradeTableEmptyState
          title="Loading trades"
          description="Pulling the current trade ledger and building your filtered view."
        />
      );
    }

    if (hasMergedFilterConflict) {
      return (
        <TradeTableEmptyState
          title="Current filters conflict"
          description="The selected view and your manual filters do not overlap. Reset the trades view to continue."
          actionLabel="Reset trades view"
          onAction={handleResetTradeView}
        />
      );
    }

    if (hasResettableState) {
      return (
        <TradeTableEmptyState
          title="No trades match this view"
          description="Try a broader search, loosen one of the numeric filters, or reset the current trades view."
          details={
            activeEmptyStateFilters.length ? (
              <div className="flex flex-wrap justify-center gap-2">
                {activeEmptyStateFilters.map((filter) => (
                  <span
                    key={filter}
                    className="rounded-sm border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/55"
                  >
                    {filter}
                  </span>
                ))}
              </div>
            ) : null
          }
          actionLabel="Reset trades view"
          onAction={handleResetTradeView}
        />
      );
    }

    return (
      <TradeTableEmptyState
        title="No trades yet"
        description="This account does not have any synced trades yet. Once activity lands, the full review flow will show up here."
      />
    );
  }, [
    accountId,
    handleResetTradeView,
    hasMergedFilterConflict,
    hasResettableState,
    isLoading,
  ]);

  React.useEffect(() => {
    if (!ids.length) {
      lastHandledIdsParamRef.current = "";
      return;
    }

    if (lastHandledIdsParamRef.current === idsParam) {
      return;
    }

    const tradeById = new Map(displayRows.map((trade) => [trade.id, trade]));
    const matchedTrades = ids
      .map((id) => tradeById.get(id))
      .filter((trade): trade is TradeRow => Boolean(trade));

    if (matchedTrades.length !== ids.length) {
      return;
    }

    const nextSelection: Record<string, boolean> = {};
    ids.forEach((id) => {
      nextSelection[id] = true;
    });
    table.setRowSelection(nextSelection);

    if (matchedTrades.length === 1) {
      dispatch({ type: "openTrade", tradeId: matchedTrades[0].id });
      dispatch({ type: "setCompareOpen", open: false });
    } else if (matchedTrades.length >= 2 && matchedTrades.length <= 4) {
      dispatch({ type: "setDetailOpen", open: false });
      dispatch({ type: "setCompareOpen", open: true });
    }

    lastHandledIdsParamRef.current = idsParam;
  }, [displayRows, ids, idsParam, table]);

  const handleAppliedStatFilters = React.useCallback(
    (filters: typeof statFilters | undefined) => {
      const nextFilters = filters || statFilters;
      setRrParam(
        nextFilters.rrMin != null || nextFilters.rrMax != null
          ? `${nextFilters.rrMin ?? ""}:${nextFilters.rrMax ?? ""}`
          : null
      );
      setMfeParam(
        nextFilters.mfeMin != null || nextFilters.mfeMax != null
          ? `${nextFilters.mfeMin ?? ""}:${nextFilters.mfeMax ?? ""}`
          : null
      );
      setMaeParam(
        nextFilters.maeMin != null || nextFilters.maeMax != null
          ? `${nextFilters.maeMin ?? ""}:${nextFilters.maeMax ?? ""}`
          : null
      );
      setEffParam(
        nextFilters.efficiencyMin != null || nextFilters.efficiencyMax != null
          ? `${nextFilters.efficiencyMin ?? ""}:${nextFilters.efficiencyMax ?? ""}`
          : null
      );
    },
    [setEffParam, setMaeParam, setMfeParam, setRrParam, statFilters]
  );

  const handleToolbarRangeChange = React.useCallback(
    (startValue?: Date, endValue?: Date) => {
      if (!startValue || !endValue) {
        setRangeParams({ oStart: null, oEnd: null });
        return;
      }

      const toYMD = (value: Date) => value.toISOString().slice(0, 10);
      const nextStart = toYMD(startValue);
      const nextEnd = toYMD(endValue);
      const updates: { oStart?: string | null; oEnd?: string | null } = {};
      if (nextStart !== (oStart || "")) updates.oStart = nextStart;
      if (nextEnd !== (oEnd || "")) updates.oEnd = nextEnd;
      if (Object.keys(updates).length) setRangeParams(updates);
    },
    [oEnd, oStart, setRangeParams]
  );

  const tradeFiltersContextValue = React.useMemo(
    () => ({
      allKillzones,
      allModelTags,
      allSessionTags,
      allSymbols,
      commissionsHistogram,
      commissionsMax: rawComRange?.[1],
      commissionsMin: rawComRange?.[0],
      efficiencyHistogram,
      end,
      holdHistogram,
      holdMax: holdRange?.[1],
      holdMin: holdRange?.[0],
      killzones,
      maeHistogram,
      maxBound,
      mfeHistogram,
      minBound,
      modelTags,
      onCommissionsClear: () => setComParam(null),
      onCommissionsCommit: (lo: number, hi: number) =>
        setComParam(serializeDecimalRange(lo, hi, 2)),
      onDirectionChange: (direction: "all" | "long" | "short") =>
        setDirParam(direction),
      onHoldClear: () => setHoldParam(null),
      onHoldCommit: (lo: number, hi: number) =>
        setHoldParam(serializeIntegerRange(lo, hi)),
      onKillzonesChange: (values: string[]) =>
        setKillzonesParam(values.length ? values.join(",") : null),
      onModelTagsChange: (values: string[]) =>
        setModelTagsParam(values.length ? values.join(",") : null),
      onOutcomesChange: (values: string[]) =>
        setOutcomeParam(values.length ? values.join(",") : null),
      onProfitClear: () => setPlParam(null),
      onProfitCommit: (lo: number, hi: number) =>
        setPlParam(serializeDecimalRange(lo, hi, 2)),
      onProtocolAlignmentsChange: (values: string[]) =>
        setProtocolParam(values.length ? values.join(",") : null),
      onQChange: (value: string) => setQParam(value || null),
      onRangeChange: handleToolbarRangeChange,
      onSessionTagsChange: (values: string[]) =>
        setSessionTagsParam(values.length ? values.join(",") : null),
      onStatFiltersApply: handleAppliedStatFilters,
      onStatFiltersChange: setStatFilters,
      onSwapClear: () => setSwapParam(null),
      onSwapCommit: (lo: number, hi: number) =>
        setSwapParam(serializeDecimalRange(lo, hi, 2)),
      onSymbolsChange: (values: string[]) =>
        setSymbolsParam(values.length ? values.join(",") : null),
      onVolumeClear: () => setVolParam(null),
      onVolumeCommit: (lo: number, hi: number) =>
        setVolParam(serializeDecimalRange(lo, hi, 4)),
      outcomes,
      profitHistogram,
      profitMax: rawPlRange?.[1],
      profitMin: rawPlRange?.[0],
      protocolAlignments,
      q,
      rrHistogram,
      sessionTags,
      start,
      statFilters,
      swapHistogram,
      swapMax: rawSwapRange?.[1],
      swapMin: rawSwapRange?.[0],
      symbolCounts,
      symbolTotal,
      symbols,
      tradeDirection,
      volumeHistogram,
      volumeMax: volRange?.[1],
      volumeMin: volRange?.[0],
    }),
    [
      allKillzones,
      allModelTags,
      allSessionTags,
      allSymbols,
      commissionsHistogram,
      efficiencyHistogram,
      end,
      handleAppliedStatFilters,
      handleToolbarRangeChange,
      holdHistogram,
      holdRange,
      killzones,
      maeHistogram,
      maxBound,
      mfeHistogram,
      minBound,
      modelTags,
      oEnd,
      oStart,
      outcomes,
      profitHistogram,
      protocolAlignments,
      q,
      rawComRange,
      rawPlRange,
      rawSwapRange,
      rrHistogram,
      sessionTags,
      setComParam,
      setDirParam,
      setHoldParam,
      setKillzonesParam,
      setModelTagsParam,
      setOutcomeParam,
      setPlParam,
      setProtocolParam,
      setQParam,
      setRangeParams,
      setSessionTagsParam,
      setStatFilters,
      setSwapParam,
      setSymbolsParam,
      setVolParam,
      start,
      statFilters,
      swapHistogram,
      symbolCounts,
      symbolTotal,
      symbols,
      tradeDirection,
      volRange,
      volumeHistogram,
    ]
  );

  return (
    <div className="w-full overflow-hidden">
      <TradeFiltersProvider value={tradeFiltersContextValue}>
        <TradesToolbar
          table={table}
          tableId="trades"
          accountId={accountId || null}
          sortValue={sortParam || ""}
          onSortChange={(value) => {
            const [id, dir] = value.split(":");
            if (!id) return;
            setSorting([{ id, desc: dir === "desc" }] as any);
            setSortParam(value || null);
          }}
          onClearSort={() => {
            setSorting([{ id: "open", desc: true }] as any);
            setSortParam("open:desc");
          }}
          pnlMode={tradePnlMode}
          onPnlModeChange={(mode) => setPnlMode(mode)}
          baselineInitialBalance={baselineInitialBalance}
          ddMode={tradeDdMode}
          onDdModeChange={(mode) => setDdMode(mode)}
          selectedViewId={viewParam || null}
          onViewChange={(viewId) => setViewParam(viewId || null)}
          onManageViews={() =>
            dispatch({ type: "setManageViewsOpen", open: true })
          }
          groupBy={groupBy}
          onGroupByChange={(nextGroupBy) =>
            dispatch({ type: "setGroupBy", groupBy: nextGroupBy })
          }
        />
      </TradeFiltersProvider>

      <TradeTableUtilityBar
        filterPresets={filterPresets}
        isMobile={isMobile}
        onApplyPreset={handleApplyPreset}
        onDeletePreset={handleDeletePreset}
        onSavePreset={handleSavePreset}
        onSummaryMetricsChange={(metricIds) => {
          if (metricIds.length === 0) {
            return;
          }
          void updatePreferences({ summaryMetrics: metricIds });
        }}
        onViewModeChange={(nextViewMode) => {
          dispatch({ type: "setViewMode", viewMode: nextViewMode });
          void updatePreferences({ viewMode: nextViewMode });
        }}
        summaryMetrics={summaryMetrics}
        viewMode={viewMode}
      />

      {sampleGateStatus?.length ? (
        <SampleGateBanner status={sampleGateStatus} />
      ) : null}

      {showTopProgress ? (
        <div className="mb-2 overflow-hidden rounded-sm border border-white/5 bg-sidebar/70">
          <div className="h-1 w-full overflow-hidden bg-white/5">
            <div className="h-full w-1/3 animate-pulse bg-teal-400/70" />
          </div>
        </div>
      ) : null}

      {viewMode === "table" ? (
        <DataTable
          table={table}
          usePaginationRows
          fitColumnsToContent
          focusedRowId={focusedTradeId}
          onRowClick={(row) =>
            dispatch({ type: "setFocusedTradeId", tradeId: row.id })
          }
          onRowDoubleClick={handleRowDoubleClick}
          onRowPointerDown={dragSelect.handlePointerDown}
          onRowPointerEnter={dragSelect.handlePointerEnter}
          onRowPointerUp={() => dragSelect.handlePointerUp()}
          containerRef={dragSelect.containerRef}
          emptyState={emptyState}
          onRenderedRowIdsChange={
            isDrawdownVisible ? setRenderedTradeIds : undefined
          }
          getRowGroupKey={
            groupBy
              ? (row) => getTradeTableGroupKey(groupBy, row.original)
              : undefined
          }
          renderRowGroupHeader={
            groupBy
              ? ({ groupKey, rows, isCollapsed, onToggleCollapsed }) => (
                  <TradeTableGroupHeader
                    groupKey={groupKey}
                    rows={rows.map((row) => row.original)}
                    pnlMode={tradePnlMode}
                    baselineInitialBalance={baselineInitialBalance}
                    isCollapsed={isCollapsed}
                    onToggleCollapsed={onToggleCollapsed}
                  />
                )
              : undefined
          }
        />
      ) : (
        <TradeTableMobileList
          rows={currentPageTradeRows}
          emptyState={emptyState}
          focusedTradeId={focusedTradeId}
          onOpenTrade={handleOpenTrade}
          onRowClick={(trade) =>
            dispatch({ type: "setFocusedTradeId", tradeId: trade.id })
          }
          onRowPointerDown={dragSelect.handlePointerDown}
          onRowPointerEnter={dragSelect.handlePointerEnter}
          selectedTradeIds={selectedTradeIds}
          suppressNextClick={dragSelect.shouldSuppressClick}
          toggleTradeSelection={handleToggleTradeSelection}
        />
      )}

      <TradeTablePagination
        displayRowsCount={displayRows.length}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading}
        loadedPageCount={loadedPageCount}
        onNextPage={handleNextPage}
        onPreviousPage={() => table.previousPage()}
        pageEnd={pageEnd}
        pageIndex={pageIndex}
        pageStart={pageStart}
        totalRowsCount={Math.max(totalFilteredDisplayRows, displayRows.length)}
      />

      {!isLoading && displayRows.length > 0 ? (
        <PerformanceSummaryBar
          availableTrades={Math.max(totalFilteredDisplayRows, displayRows.length)}
          bestTrade={summary.bestTrade}
          currentStreakCount={summary.currentStreakCount}
          currentStreakType={summary.currentStreakType}
          expectancyPerTrade={summary.expectancyPerTrade}
          totalTrades={summary.totalTrades}
          totalPnL={summary.totalPnL}
          netPnL={summary.netPnL}
          profitFactor={summary.profitFactor}
          winRate={summary.winRate}
          avgRR={summary.avgRR}
          totalVolume={summary.totalVolume}
          visibleTrades={displayRows.length}
          wins={summary.wins}
          losses={summary.losses}
          breakeven={summary.breakeven}
          worstTrade={summary.worstTrade}
          pnlMode={tradePnlMode}
          baselineInitialBalance={baselineInitialBalance}
          visibleMetricIds={summaryMetrics}
        />
      ) : null}

      {/* Bulk Actions Toolbar */}
      {selectedTradeIds.size > 0 && (
        <BulkActionsToolbar
          selectedCount={selectedTradeIds.size}
          selectedIds={selectedTradeIds}
          selectedTrades={selectedTrades}
          visibleColumns={visibleColumnIds}
          sharePath="/dashboard/trades"
          onCompare={
            selectedTrades.length >= 2 && selectedTrades.length <= 4
              ? () => dispatch({ type: "setCompareOpen", open: true })
              : undefined
          }
          onOpenTradeDetails={
            singleSelectedTrade
              ? () => handleOpenTrade(singleSelectedTrade)
              : undefined
          }
          onClear={() => {
            handleClearSelection();
          }}
        />
      )}

      <TradeTableSheets
        accountId={accountId || null}
        compareOpen={compareOpen}
        manageViewsOpen={manageViewsOpen}
        onCompareOpenChange={(open) =>
          dispatch({ type: "setCompareOpen", open })
        }
        onManageViewsOpenChange={(open) =>
          dispatch({ type: "setManageViewsOpen", open })
        }
        onTradeDetailOpenChange={(open) =>
          dispatch({ type: "setDetailOpen", open })
        }
        selectedTrade={selectedTrade}
        selectedTrades={selectedTrades}
        tradeDetailOpen={openSheet}
      />
    </div>
  );
}
