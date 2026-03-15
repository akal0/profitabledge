"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { Input } from "@/components/ui/input";
import { useDateRangeStore } from "@/stores/date-range";
import { ViewSwitcher } from "@/components/view-switcher";

import { TradesToolbarAppliedFilters } from "./trades-toolbar-applied-filters";
import {
  TradesToolbarDisplayControls,
  TradesToolbarGroupControl,
  TradesToolbarSortControls,
} from "./trades-toolbar-controls";
import { TradesToolbarFilterMenu } from "./trades-toolbar-filter-menu";
import type {
  StatFilters,
  TradesToolbarProps,
} from "../lib/trades-toolbar-types";
import { buildAppliedFilters, getSortBadge } from "../lib/trades-toolbar-utils";

export default function TradesToolbar({
  q,
  table,
  tableId,
  onQChange,
  tradeDirection,
  onDirectionChange,
  symbols,
  onSymbolsChange,
  allSymbols,
  symbolCounts,
  symbolTotal,
  killzones,
  onKillzonesChange,
  allKillzones,
  sessionTags,
  onSessionTagsChange,
  allSessionTags,
  modelTags,
  onModelTagsChange,
  allModelTags,
  protocolAlignments,
  onProtocolAlignmentsChange,
  outcomes,
  onOutcomesChange,
  sortValue,
  onSortChange,
  onClearSort,
  start,
  end,
  minBound,
  maxBound,
  onRangeChange,
  holdMin,
  holdMax,
  holdHistogram,
  onHoldCommit,
  onHoldClear,
  volumeMin,
  volumeMax,
  volumeHistogram,
  onVolumeCommit,
  onVolumeClear,
  profitMin,
  profitMax,
  profitHistogram,
  onProfitCommit,
  onProfitClear,
  commissionsMin,
  commissionsMax,
  commissionsHistogram,
  onCommissionsCommit,
  onCommissionsClear,
  swapMin,
  swapMax,
  swapHistogram,
  onSwapCommit,
  onSwapClear,
  rrHistogram,
  mfeHistogram,
  maeHistogram,
  efficiencyHistogram,
  pnlMode,
  onPnlModeChange,
  baselineInitialBalance,
  ddMode,
  onDdModeChange,
  selectedViewId,
  onViewChange,
  onManageViews,
  accountId,
  statFilters: statFiltersProp,
  onStatFiltersChange,
  onStatFiltersApply,
  groupBy,
  onGroupByChange,
}: TradesToolbarProps) {
  const { min, max } = useDateRangeStore();
  const [statFilters, setStatFilters] = React.useState<StatFilters>(
    statFiltersProp || {}
  );
  const [searchValue, setSearchValue] = React.useState(q);
  const debouncedQ = useDebouncedCallback(onQChange, 300);

  React.useEffect(() => {
    setSearchValue(q);
  }, [q]);

  React.useEffect(() => {
    setStatFilters(statFiltersProp || {});
  }, [statFiltersProp]);

  React.useEffect(() => {
    onStatFiltersChange?.(statFilters);
  }, [onStatFiltersChange, statFilters]);

  const sortBadge = React.useMemo(() => getSortBadge(sortValue), [sortValue]);

  const clearStatFilter = React.useCallback(
    (keys: Array<keyof StatFilters>) => {
      const next = { ...statFilters };
      keys.forEach((key) => {
        next[key] = undefined;
      });
      setStatFilters(next);
      onStatFiltersChange?.(next);
      onStatFiltersApply?.(next);
    },
    [onStatFiltersApply, onStatFiltersChange, statFilters]
  );

  const appliedFilters = React.useMemo(
    () =>
      buildAppliedFilters({
        start,
        end,
        onClearDate: () => onRangeChange(undefined, undefined),
        tradeDirection,
        onClearDirection: () => onDirectionChange("all"),
        holdMin,
        holdMax,
        holdHistogram,
        onClearHold: () => onHoldClear?.(),
        volumeMin,
        volumeMax,
        volumeHistogram,
        onClearVolume: () => onVolumeClear?.(),
        profitMin,
        profitMax,
        profitHistogram,
        onClearProfit: () => onProfitClear?.(),
        commissionsMin,
        commissionsMax,
        commissionsHistogram,
        onClearCommissions: () => onCommissionsClear?.(),
        swapMin,
        swapMax,
        swapHistogram,
        onClearSwap: () => onSwapClear?.(),
        killzones,
        allKillzonesLength: allKillzones?.length || 0,
        onClearKillzones: () => onKillzonesChange([]),
        sessionTags,
        allSessionTagsLength: allSessionTags?.length || 0,
        onClearSessionTags: () => onSessionTagsChange([]),
        modelTags,
        allModelTagsLength: allModelTags?.length || 0,
        onClearModelTags: () => onModelTagsChange([]),
        protocolAlignments,
        onClearProtocol: () => onProtocolAlignmentsChange([]),
        outcomes,
        onClearOutcomes: () => onOutcomesChange([]),
        symbols,
        allSymbolsLength: allSymbols?.length || 0,
        onClearSymbols: () => onSymbolsChange([]),
        statFilters,
        onClearRr: () => clearStatFilter(["rrMin", "rrMax"]),
        onClearMfe: () => clearStatFilter(["mfeMin", "mfeMax"]),
        onClearMae: () => clearStatFilter(["maeMin", "maeMax"]),
        onClearEfficiency: () =>
          clearStatFilter(["efficiencyMin", "efficiencyMax"]),
      }),
    [
      allKillzones?.length,
      allModelTags?.length,
      allSessionTags?.length,
      allSymbols?.length,
      clearStatFilter,
      commissionsHistogram,
      commissionsMax,
      commissionsMin,
      end,
      holdHistogram,
      holdMax,
      holdMin,
      killzones,
      modelTags,
      onCommissionsClear,
      onDirectionChange,
      onHoldClear,
      onKillzonesChange,
      onModelTagsChange,
      onOutcomesChange,
      onProfitClear,
      onProtocolAlignmentsChange,
      onRangeChange,
      onSessionTagsChange,
      onSwapClear,
      onSymbolsChange,
      onVolumeClear,
      outcomes,
      profitHistogram,
      profitMax,
      profitMin,
      protocolAlignments,
      sessionTags,
      start,
      statFilters,
      swapHistogram,
      swapMax,
      swapMin,
      symbols,
      tradeDirection,
      volumeHistogram,
      volumeMax,
      volumeMin,
    ]
  );

  return (
    <div className="flex w-full items-center justify-between gap-2 py-2 px-[1px]">
      <div className="flex items-center gap-2">
        {onViewChange ? (
          <ViewSwitcher
            selectedViewId={selectedViewId}
            onViewChange={onViewChange}
            onManageViews={onManageViews}
            accountId={accountId || null}
          />
        ) : null}

        <div className="group relative flex h-[38px] w-128 items-center rounded-sm border border-white/5 pl-8 pr-2 transition duration-250 hover:bg-sidebar-accent">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40 transition-colors group-hover:text-white/60" />
          <Input
            type="search"
            placeholder="Search anything"
            value={searchValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchValue(nextValue);
              debouncedQ(nextValue);
            }}
            className="h-full ring-0 bg-transparent px-0 py-0 text-xs focus-visible:scale-100 group-hover:bg-transparent! hover:bg-transparent! focus-visible:bg-transparent"
          />
          <TradesToolbarFilterMenu
            appliedFilterCount={appliedFilters.length}
            minDate={minBound || min || new Date(0)}
            maxDate={maxBound || max || new Date()}
            start={start}
            end={end}
            onRangeChange={onRangeChange}
            tradeDirection={tradeDirection}
            onDirectionChange={onDirectionChange}
            symbols={symbols}
            onSymbolsChange={onSymbolsChange}
            allSymbols={allSymbols}
            symbolCounts={symbolCounts}
            symbolTotal={symbolTotal}
            holdMin={holdMin}
            holdMax={holdMax}
            holdHistogram={holdHistogram}
            onHoldCommit={onHoldCommit}
            volumeMin={volumeMin}
            volumeMax={volumeMax}
            volumeHistogram={volumeHistogram}
            onVolumeCommit={onVolumeCommit}
            profitMin={profitMin}
            profitMax={profitMax}
            profitHistogram={profitHistogram}
            onProfitCommit={onProfitCommit}
            commissionsMin={commissionsMin}
            commissionsMax={commissionsMax}
            commissionsHistogram={commissionsHistogram}
            onCommissionsCommit={onCommissionsCommit}
            swapMin={swapMin}
            swapMax={swapMax}
            swapHistogram={swapHistogram}
            onSwapCommit={onSwapCommit}
            killzones={killzones}
            onKillzonesChange={onKillzonesChange}
            allKillzones={allKillzones}
            sessionTags={sessionTags}
            onSessionTagsChange={onSessionTagsChange}
            allSessionTags={allSessionTags}
            modelTags={modelTags}
            onModelTagsChange={onModelTagsChange}
            allModelTags={allModelTags}
            protocolAlignments={protocolAlignments}
            onProtocolAlignmentsChange={onProtocolAlignmentsChange}
            outcomes={outcomes}
            onOutcomesChange={onOutcomesChange}
            statFilters={statFilters}
            setStatFilters={setStatFilters}
            onStatFiltersApply={onStatFiltersApply}
            rrHistogram={rrHistogram}
            mfeHistogram={mfeHistogram}
            maeHistogram={maeHistogram}
            efficiencyHistogram={efficiencyHistogram}
          />
        </div>

        <TradesToolbarGroupControl
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
        />

        <TradesToolbarAppliedFilters filters={appliedFilters} />

        <TradesToolbarSortControls
          sortBadge={sortBadge}
          onSortChange={onSortChange}
          onClearSort={onClearSort}
        />
      </div>

      <div className="flex items-center gap-2">
        <TradesToolbarDisplayControls
          pnlMode={pnlMode}
          onPnlModeChange={onPnlModeChange}
          baselineInitialBalance={baselineInitialBalance}
          ddMode={ddMode}
          onDdModeChange={onDdModeChange}
          table={table}
          tableId={tableId}
        />
      </div>
    </div>
  );
}
