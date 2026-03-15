"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/index";
import { useDataTable } from "@/hooks/use-data-table";
import { useAccountStore } from "@/stores/account";
import TradesToolbar from "@/features/trades/table-toolbar/components/trades-toolbar";
import { useQueryState } from "nuqs";
import { ViewManagementDialog } from "@/components/view-management-dialog";
import { SampleGateBanner } from "@/components/sample-gate-banner";
import { PerformanceSummaryBar } from "@/components/trades/performance-summary-bar";
import { useDragSelect } from "@/hooks/use-drag-select";
import { BulkActionsToolbar } from "@/features/trades/bulk-actions/components/bulk-actions-toolbar";
import { TradeComparisonSheet } from "@/components/trades/trade-comparison-sheet";
import { TradeDetailSheet } from "@/features/trades/table/components/trade-detail-sheet";
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
import { useTradeTableFilteredData } from "@/features/trades/table/hooks/use-trade-table-filtered-data";
import { useTradeTableFilterControls } from "@/features/trades/table/hooks/use-trade-table-filter-controls";
import { useTradeTableReferenceData } from "@/features/trades/table/hooks/use-trade-table-reference-data";
import { summarizeTradeRows } from "@/features/trades/table/lib/trade-table-summary";
import type { NumericRange } from "@/features/trades/table/lib/trade-table-view-state";
import {
  serializeDecimalRange,
  serializeIntegerRange,
} from "@/features/trades/table/lib/trade-table-query-state";
import { queryClient, trpcClient } from "@/utils/trpc";
import type {
  InlineTradeUpdateInput,
  TradePnlDisplayMode,
  TradeRow,
} from "@/features/trades/table/lib/trade-table-types";

export default function TradeTableInfinite() {
  const accountId = useAccountStore((s) => s.selectedAccountId) ?? null;
  const { ref, inView } = useInView({ rootMargin: "200px" });

  // View management state
  const [manageViewsOpen, setManageViewsOpen] = React.useState(false);
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
  const [groupBy, setGroupBy] = React.useState<TradeTableGroupBy | null>(null);
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
    baseRows,
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

  const updateTradeMutation = useMutation({
    mutationFn: async (input: InlineTradeUpdateInput) =>
      trpcClient.trades.update.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      queryClient.refetchQueries({ queryKey: [["trades"]] });
    },
    onError: (error) => {
      console.error("Inline trade update failed:", error);
      toast.error("Couldn’t update that trade cell. Please try again.");
    },
  });

  const handleInlineTradeUpdate = React.useCallback(
    async (input: InlineTradeUpdateInput) => {
      await updateTradeMutation.mutateAsync(input);
    },
    [updateTradeMutation]
  );

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const initialVisibility = React.useMemo(
    () =>
      viewParam
        ? buildTradeTableColumnVisibility(viewParam, selectedViewVisibleColumns)
        : undefined,
    [selectedViewVisibleColumns, viewParam]
  );
  const initialSizing = React.useMemo(() => buildTradeTableInitialSizing(), []);

  const { table, sorting, setSorting, setColumnVisibility } =
    useDataTable<TradeRow>({
      data: displayRows,
      columns: tradeTableColumns,
      tableId: "trades",
      disablePreferences: Boolean(viewParam),
      meta: {
        totalTradesCount,
        disableSampleGating,
        pnlMode: tradePnlMode,
        baselineInitialBalance,
        streakByTradeId,
        updateTrade: handleInlineTradeUpdate,
      },
      initialVisibility,
      initialSizing,
      getRowId: (row) => row.id, // Use trade ID as row ID
    });

  // Update column visibility when view changes
  React.useEffect(() => {
    if (!viewParam) {
      return;
    }

    setColumnVisibility(
      buildTradeTableColumnVisibility(viewParam, selectedViewVisibleColumns)
    );
  }, [selectedViewVisibleColumns, setColumnVisibility, viewParam]);

  const [openSheet, setOpenSheet] = React.useState(false);
  const [selectedTrade, setSelectedTrade] = React.useState<TradeRow | null>(
    null
  );
  const handleRowDoubleClick = React.useCallback((row: TradeRow) => {
    setSelectedTrade(row);
    setOpenSheet(true);
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

  // Drag select functionality
  const dragSelect = useDragSelect({
    onSelectionChange: (selectedTradeIds) => {
      // selectedTradeIds are now actual trade IDs (since we use getRowId)
      const rowSelection: Record<string, boolean> = {};
      selectedTradeIds.forEach((tradeId) => {
        rowSelection[tradeId] = true;
      });
      table.setRowSelection(rowSelection);
    },
  });

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
  const selectedTrades = React.useMemo(
    () => {
      if (selectedTradeIdList.length === 0) {
        return [];
      }

      const tradeById = new Map(displayRows.map((trade) => [trade.id, trade]));
      return selectedTradeIdList
        .map((tradeId) => tradeById.get(tradeId))
        .filter((trade): trade is TradeRow => Boolean(trade));
    },
    [displayRows, selectedTradeIdList]
  );
  const singleSelectedTrade =
    selectedTradeIdList.length === 1 && selectedTrades.length === 1
      ? selectedTrades[0]
      : null;
  const summary = React.useMemo(
    () => summarizeTradeRows(displayRows),
    [displayRows]
  );
  const visibleColumnIds = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .filter((id) => id !== "select" && id !== "actions"),
    [table]
  );
  const [compareOpen, setCompareOpen] = React.useState(false);
  const lastHandledIdsParamRef = React.useRef<string>("");
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

  const handleResetTradeView = React.useCallback(() => {
    setGroupBy(null);
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
      setSelectedTrade(matchedTrades[0]);
      setOpenSheet(true);
      setCompareOpen(false);
    } else if (matchedTrades.length >= 2 && matchedTrades.length <= 4) {
      setOpenSheet(false);
      setCompareOpen(true);
    }

    lastHandledIdsParamRef.current = idsParam;
  }, [displayRows, ids, idsParam, table]);

  return (
    <div className="w-full overflow-hidden">
      <TradesToolbar
        q={q}
        table={table}
        tableId="trades"
        accountId={accountId || null}
        onQChange={(val) => setQParam(val || null)}
        tradeDirection={tradeDirection}
        onDirectionChange={(d) => setDirParam(d)}
        symbols={symbols}
        onSymbolsChange={(arr) =>
          setSymbolsParam(arr.length ? arr.join(",") : null)
        }
        symbolCounts={symbolCounts}
        symbolTotal={symbolTotal}
        killzones={killzones}
        onKillzonesChange={(arr) =>
          setKillzonesParam(arr.length ? arr.join(",") : null)
        }
        allKillzones={allKillzones}
        sessionTags={sessionTags}
        onSessionTagsChange={(arr) =>
          setSessionTagsParam(arr.length ? arr.join(",") : null)
        }
        allSessionTags={allSessionTags}
        modelTags={modelTags}
        onModelTagsChange={(arr) =>
          setModelTagsParam(arr.length ? arr.join(",") : null)
        }
        allModelTags={allModelTags}
        protocolAlignments={protocolAlignments}
        onProtocolAlignmentsChange={(arr) =>
          setProtocolParam(arr.length ? arr.join(",") : null)
        }
        outcomes={outcomes}
        onOutcomesChange={(arr) =>
          setOutcomeParam(arr.length ? arr.join(",") : null)
        }
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
        start={start}
        end={end}
        minBound={minBound}
        maxBound={maxBound}
        allSymbols={allSymbols}
        holdMin={holdRange?.[0]}
        holdMax={holdRange?.[1]}
        holdHistogram={holdHistogram}
        onHoldCommit={(lo, hi) => setHoldParam(serializeIntegerRange(lo, hi))}
        onHoldClear={() => setHoldParam(null)}
        volumeMin={volRange?.[0]}
        volumeMax={volRange?.[1]}
        volumeHistogram={volumeHistogram}
        onVolumeCommit={(lo, hi) =>
          setVolParam(serializeDecimalRange(lo, hi, 4))
        }
        onVolumeClear={() => setVolParam(null)}
        profitMin={rawPlRange?.[0]}
        profitMax={rawPlRange?.[1]}
        profitHistogram={profitHistogram}
        onProfitCommit={(lo, hi) =>
          setPlParam(serializeDecimalRange(lo, hi, 2))
        }
        onProfitClear={() => setPlParam(null)}
        commissionsMin={rawComRange?.[0]}
        commissionsMax={rawComRange?.[1]}
        commissionsHistogram={commissionsHistogram}
        onCommissionsCommit={(lo, hi) =>
          setComParam(serializeDecimalRange(lo, hi, 2))
        }
        onCommissionsClear={() => setComParam(null)}
        swapMin={rawSwapRange?.[0]}
        swapMax={rawSwapRange?.[1]}
        swapHistogram={swapHistogram}
        onSwapCommit={(lo, hi) =>
          setSwapParam(serializeDecimalRange(lo, hi, 2))
        }
        onSwapClear={() => setSwapParam(null)}
        rrHistogram={rrHistogram}
        mfeHistogram={mfeHistogram}
        maeHistogram={maeHistogram}
        efficiencyHistogram={efficiencyHistogram}
        statFilters={statFilters}
        onStatFiltersChange={setStatFilters}
        onStatFiltersApply={(filters) => {
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
            nextFilters.efficiencyMin != null ||
              nextFilters.efficiencyMax != null
              ? `${nextFilters.efficiencyMin ?? ""}:${
                  nextFilters.efficiencyMax ?? ""
                }`
              : null
          );
        }}
        pnlMode={tradePnlMode}
        onPnlModeChange={(mode) => setPnlMode(mode)}
        baselineInitialBalance={baselineInitialBalance}
        ddMode={tradeDdMode}
        onDdModeChange={(m) => setDdMode(m)}
        selectedViewId={viewParam || null}
        onViewChange={(viewId) => setViewParam(viewId || null)}
        onManageViews={() => setManageViewsOpen(true)}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onRangeChange={(s, e) => {
          if (!s || !e) {
            setRangeParams({ oStart: null, oEnd: null });
          } else {
            const toYMD = (d: Date) => d.toISOString().slice(0, 10);
            const ns = toYMD(s);
            const ne = toYMD(e);
            const updates: { oStart?: string | null; oEnd?: string | null } =
              {};
            if (ns !== (oStart || "")) updates.oStart = ns;
            if (ne !== (oEnd || "")) updates.oEnd = ne;
            if (Object.keys(updates).length) setRangeParams(updates);
          }
        }}
      />

      {sampleGateStatus?.length ? (
        <SampleGateBanner status={sampleGateStatus} />
      ) : null}

      <DataTable
        key={
          (accountId || "") +
          "|" +
          tradeDirection +
          "|" +
          (q || "") +
          "|" +
          (idsParam || "") +
          "|" +
          (symbols.slice().sort().join(",") || "") +
          "|" +
          (start ? start.toISOString() : "") +
          "|" +
          (end ? end.toISOString() : "") +
          "|" +
          (holdParam || "") +
          "|" +
          (volParam || "") +
          "|" +
          (plParam || "") +
          "|" +
          (comParam || "") +
          "|" +
          (swapParam || "") +
          "|" +
          (rrParam || "") +
          "|" +
          (mfeParam || "") +
          "|" +
          (maeParam || "") +
          "|" +
          (effParam || "") +
          "|" +
          (viewParam || "")
        }
        table={table}
        onRowDoubleClick={handleRowDoubleClick}
        onRowMouseDown={dragSelect.handleMouseDown}
        onRowMouseEnter={dragSelect.handleMouseEnter}
        containerRef={dragSelect.containerRef}
        emptyState={emptyState}
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

      {!isLoading && displayRows.length > 0 ? (
        <PerformanceSummaryBar
          totalTrades={summary.totalTrades}
          totalPnL={summary.totalPnL}
          netPnL={summary.netPnL}
          winRate={summary.winRate}
          avgRR={summary.avgRR}
          totalVolume={summary.totalVolume}
          wins={summary.wins}
          losses={summary.losses}
          breakeven={summary.breakeven}
          pnlMode={tradePnlMode}
          baselineInitialBalance={baselineInitialBalance}
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
              ? () => setCompareOpen(true)
              : undefined
          }
          onOpenTradeDetails={
            singleSelectedTrade
              ? () => {
                  setSelectedTrade(singleSelectedTrade);
                  setOpenSheet(true);
                }
              : undefined
          }
          onClear={() => {
            table.resetRowSelection();
            dragSelect.clearSelection();
          }}
        />
      )}

      {!isLoading && displayRows.length > 0 ? (
        <div ref={ref} className="py-6 text-center text-xs text-white/40">
          {isFetchingNextPage
            ? "Loading more..."
            : hasNextPage
            ? "Scroll to load more"
            : "You've reached the end of all trades for this account."}
        </div>
      ) : null}

      <TradeComparisonSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        trades={selectedTrades}
      />
      <TradeDetailSheet
        accountId={accountId || null}
        open={openSheet}
        onOpenChange={setOpenSheet}
        selectedTrade={selectedTrade}
      />

      {/* View Management Dialog */}
      <ViewManagementDialog
        open={manageViewsOpen}
        onOpenChange={setManageViewsOpen}
      />
    </div>
  );
}
