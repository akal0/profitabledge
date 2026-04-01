"use client";

import * as React from "react";
import { SearchIcon, SlidersHorizontal } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewSwitcher } from "@/components/view-switcher";
import { useDateRangeStore } from "@/stores/date-range";
import { useIsMobile } from "@/hooks/use-mobile";

import { TradesToolbarAppliedFilters } from "./trades-toolbar-applied-filters";
import {
  TradesToolbarDisplayControls,
  TradesToolbarGroupControl,
  TradesToolbarSortControls,
} from "./trades-toolbar-controls";
import { TradesToolbarFilterMenu } from "./trades-toolbar-filter-menu";
import { useTradeFiltersContext } from "../lib/trade-filters-context";
import type { AppliedFilter, StatFilters, TradesToolbarProps } from "../lib/trades-toolbar-types";
import {
  ALL_OUTCOME_FILTER_VALUES,
  OUTCOME_FILTER_LABELS,
} from "../lib/trades-toolbar-types";
import {
  formatHoldBadge,
  formatHuman,
  formatNumBadge,
  getSortBadge,
} from "../lib/trades-toolbar-utils";

export default function TradesToolbar({
  table,
  tableId,
  sortValue,
  onSortChange,
  onClearSort,
  pnlMode,
  onPnlModeChange,
  baselineInitialBalance,
  ddMode,
  onDdModeChange,
  selectedViewId,
  onViewChange,
  onManageViews,
  accountId,
  groupBy,
  onGroupByChange,
}: TradesToolbarProps) {
  const { min, max } = useDateRangeStore();
  const filters = useTradeFiltersContext();
  const isMobile = useIsMobile();
  const [showMobileTools, setShowMobileTools] = React.useState(false);
  const [statFilters, setStatFilters] = React.useState<StatFilters>(
    filters.statFilters || {}
  );
  const [searchValue, setSearchValue] = React.useState(filters.q);
  const debouncedQ = useDebouncedCallback(filters.onQChange, 300);

  React.useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  React.useEffect(() => {
    setStatFilters(filters.statFilters || {});
  }, [filters.statFilters]);

  React.useEffect(() => {
    filters.onStatFiltersChange?.(statFilters);
  }, [filters, statFilters]);

  const sortBadge = React.useMemo(() => getSortBadge(sortValue), [sortValue]);

  const clearStatFilter = React.useCallback(
    (keys: Array<keyof StatFilters>) => {
      const next = { ...statFilters };
      keys.forEach((key) => {
        next[key] = undefined;
      });
      setStatFilters(next);
      filters.onStatFiltersChange?.(next);
      filters.onStatFiltersApply?.(next);
    },
    [filters, statFilters]
  );

  const appliedDateFilters = React.useMemo<AppliedFilter[]>(() => {
    if (!filters.start || !filters.end) {
      return [];
    }

    return [
      {
        key: "date",
        label: `Date: ${formatHuman(filters.start)} - ${formatHuman(filters.end)}`,
        onClear: () => filters.onRangeChange(undefined, undefined),
      },
    ];
  }, [filters]);

  const appliedDirectionFilters = React.useMemo<AppliedFilter[]>(() => {
    if ((filters.tradeDirection ?? "all") === "all") {
      return [];
    }

    return [
      {
        key: "direction",
        label: `Direction: ${filters.tradeDirection === "long" ? "Longs only" : "Shorts only"}`,
        onClear: () => filters.onDirectionChange("all"),
      },
    ];
  }, [filters]);

  const appliedRangeFilters = React.useMemo<AppliedFilter[]>(() => {
    const items: Array<AppliedFilter | null> = [
      typeof filters.holdMin === "number" && typeof filters.holdMax === "number"
        ? {
            key: "hold",
            label: formatHoldBadge(
              filters.holdMin,
              filters.holdMax,
              filters.holdHistogram
            ),
            onClear: () => filters.onHoldClear?.(),
          }
        : null,
      typeof filters.volumeMin === "number" && typeof filters.volumeMax === "number"
        ? {
            key: "volume",
            label: formatNumBadge(
              "Volume",
              filters.volumeMin,
              filters.volumeMax,
              filters.volumeHistogram
            ),
            onClear: () => filters.onVolumeClear?.(),
          }
        : null,
      typeof filters.profitMin === "number" && typeof filters.profitMax === "number"
        ? {
            key: "profit",
            label: formatNumBadge(
              "Profit and loss",
              filters.profitMin,
              filters.profitMax,
              filters.profitHistogram,
              "$"
            ),
            onClear: () => filters.onProfitClear?.(),
          }
        : null,
      typeof filters.commissionsMin === "number" &&
      typeof filters.commissionsMax === "number"
        ? {
            key: "commissions",
            label: formatNumBadge(
              "Commissions",
              filters.commissionsMin,
              filters.commissionsMax,
              filters.commissionsHistogram,
              "$"
            ),
            onClear: () => filters.onCommissionsClear?.(),
          }
        : null,
      typeof filters.swapMin === "number" && typeof filters.swapMax === "number"
        ? {
            key: "swap",
            label: formatNumBadge(
              "Swap",
              filters.swapMin,
              filters.swapMax,
              filters.swapHistogram,
              "$"
            ),
            onClear: () => filters.onSwapClear?.(),
          }
        : null,
    ];

    return items.filter((item): item is AppliedFilter => Boolean(item));
  }, [filters]);

  const appliedSelectionFilters = React.useMemo<AppliedFilter[]>(() => {
    const items: Array<AppliedFilter | null> = [
      filters.killzones.length > 0 && filters.killzones.length !== (filters.allKillzones?.length || 0)
        ? {
            key: "killzones",
            label: `Killzones: ${filters.killzones.slice(0, 2).join(", ")}${
              filters.killzones.length > 2 ? ` +${filters.killzones.length - 2}` : ""
            }`,
            onClear: () => filters.onKillzonesChange([]),
          }
        : null,
      filters.sessionTags.length > 0 && filters.sessionTags.length !== (filters.allSessionTags?.length || 0)
        ? {
            key: "session-tags",
            label: `Session: ${filters.sessionTags.slice(0, 2).join(", ")}${
              filters.sessionTags.length > 2 ? ` +${filters.sessionTags.length - 2}` : ""
            }`,
            onClear: () => filters.onSessionTagsChange([]),
          }
        : null,
      filters.modelTags.length > 0 && filters.modelTags.length !== (filters.allModelTags?.length || 0)
        ? {
            key: "model-tags",
            label: `Edge: ${filters.modelTags.slice(0, 2).join(", ")}${
              filters.modelTags.length > 2 ? ` +${filters.modelTags.length - 2}` : ""
            }`,
            onClear: () => filters.onModelTagsChange([]),
          }
        : null,
      filters.protocolAlignments.length > 0 && filters.protocolAlignments.length !== 3
        ? {
            key: "protocol",
            label: `Protocol: ${filters.protocolAlignments
              .slice(0, 2)
              .map((value) =>
                value === "aligned"
                  ? "Aligned"
                  : value === "against"
                  ? "Against"
                  : "Discretionary"
              )
              .join(", ")}${
              filters.protocolAlignments.length > 2
                ? ` +${filters.protocolAlignments.length - 2}`
                : ""
            }`,
            onClear: () => filters.onProtocolAlignmentsChange([]),
          }
        : null,
      filters.outcomes.length > 0 && filters.outcomes.length !== ALL_OUTCOME_FILTER_VALUES.length
        ? {
            key: "outcomes",
            label: `Outcome: ${filters.outcomes
              .slice(0, 2)
              .map((value) => OUTCOME_FILTER_LABELS[value as keyof typeof OUTCOME_FILTER_LABELS] || value)
              .join(", ")}${
              filters.outcomes.length > 2 ? ` +${filters.outcomes.length - 2}` : ""
            }`,
            onClear: () => filters.onOutcomesChange([]),
          }
        : null,
      filters.symbols.length > 0 && filters.symbols.length !== (filters.allSymbols?.length || 0)
        ? {
            key: "symbols",
            label: `Symbols: ${filters.symbols.slice(0, 2).join(", ")}${
              filters.symbols.length > 2 ? ` +${filters.symbols.length - 2}` : ""
            }`,
            onClear: () => filters.onSymbolsChange([]),
          }
        : null,
    ];

    return items.filter((item): item is AppliedFilter => Boolean(item));
  }, [filters]);

  const appliedStatFilters = React.useMemo<AppliedFilter[]>(() => {
    const items: Array<AppliedFilter | null> = [
      statFilters.rrMin != null || statFilters.rrMax != null
        ? {
            key: "rr",
            label: formatNumBadge(
              "Realised RR",
              statFilters.rrMin,
              statFilters.rrMax,
              filters.rrHistogram
            ),
            onClear: () => clearStatFilter(["rrMin", "rrMax"]),
          }
        : null,
      statFilters.mfeMin != null || statFilters.mfeMax != null
        ? {
            key: "mfe",
            label: formatNumBadge(
              "MFE",
              statFilters.mfeMin,
              statFilters.mfeMax,
              filters.mfeHistogram
            ),
            onClear: () => clearStatFilter(["mfeMin", "mfeMax"]),
          }
        : null,
      statFilters.maeMin != null || statFilters.maeMax != null
        ? {
            key: "mae",
            label: formatNumBadge(
              "MAE",
              statFilters.maeMin,
              statFilters.maeMax,
              filters.maeHistogram
            ),
            onClear: () => clearStatFilter(["maeMin", "maeMax"]),
          }
        : null,
      statFilters.efficiencyMin != null || statFilters.efficiencyMax != null
        ? {
            key: "efficiency",
            label: formatNumBadge(
              "Efficiency",
              statFilters.efficiencyMin,
              statFilters.efficiencyMax,
              filters.efficiencyHistogram
            ),
            onClear: () =>
              clearStatFilter(["efficiencyMin", "efficiencyMax"]),
          }
        : null,
    ];

    return items.filter((item): item is AppliedFilter => Boolean(item));
  }, [clearStatFilter, filters.efficiencyHistogram, filters.maeHistogram, filters.mfeHistogram, filters.rrHistogram, statFilters]);

  const appliedFilters = React.useMemo(
    () => [
      ...appliedDateFilters,
      ...appliedDirectionFilters,
      ...appliedRangeFilters,
      ...appliedSelectionFilters,
      ...appliedStatFilters,
    ],
    [
      appliedDateFilters,
      appliedDirectionFilters,
      appliedRangeFilters,
      appliedSelectionFilters,
      appliedStatFilters,
    ]
  );

  const searchInput = (
    <div className="group relative flex h-[38px] min-w-0 flex-1 items-center rounded-sm ring ring-white/5 pl-8 pr-2 transition duration-250 hover:bg-sidebar-accent md:w-128 md:flex-initial">
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
        className="h-full ring-0 bg-transparent px-0 py-0 text-xs focus-visible:scale-100 group-hover:bg-transparent! hover:bg-transparent! focus-visible:bg-transparent border-none!"
      />
      <TradesToolbarFilterMenu
        appliedFilterCount={appliedFilters.length}
        minDate={filters.minBound || min || new Date(0)}
        maxDate={filters.maxBound || max || new Date()}
        start={filters.start}
        end={filters.end}
        onRangeChange={filters.onRangeChange}
        tradeDirection={filters.tradeDirection}
        onDirectionChange={filters.onDirectionChange}
        symbols={filters.symbols}
        onSymbolsChange={filters.onSymbolsChange}
        allSymbols={filters.allSymbols}
        symbolCounts={filters.symbolCounts}
        symbolTotal={filters.symbolTotal}
        holdMin={filters.holdMin}
        holdMax={filters.holdMax}
        holdHistogram={filters.holdHistogram}
        onHoldCommit={filters.onHoldCommit}
        volumeMin={filters.volumeMin}
        volumeMax={filters.volumeMax}
        volumeHistogram={filters.volumeHistogram}
        onVolumeCommit={filters.onVolumeCommit}
        profitMin={filters.profitMin}
        profitMax={filters.profitMax}
        profitHistogram={filters.profitHistogram}
        onProfitCommit={filters.onProfitCommit}
        commissionsMin={filters.commissionsMin}
        commissionsMax={filters.commissionsMax}
        commissionsHistogram={filters.commissionsHistogram}
        onCommissionsCommit={filters.onCommissionsCommit}
        swapMin={filters.swapMin}
        swapMax={filters.swapMax}
        swapHistogram={filters.swapHistogram}
        onSwapCommit={filters.onSwapCommit}
        killzones={filters.killzones}
        onKillzonesChange={filters.onKillzonesChange}
        allKillzones={filters.allKillzones}
        sessionTags={filters.sessionTags}
        onSessionTagsChange={filters.onSessionTagsChange}
        allSessionTags={filters.allSessionTags}
        modelTags={filters.modelTags}
        onModelTagsChange={filters.onModelTagsChange}
        allModelTags={filters.allModelTags}
        protocolAlignments={filters.protocolAlignments}
        onProtocolAlignmentsChange={filters.onProtocolAlignmentsChange}
        outcomes={filters.outcomes}
        onOutcomesChange={filters.onOutcomesChange}
        statFilters={statFilters}
        setStatFilters={setStatFilters}
        onStatFiltersApply={filters.onStatFiltersApply}
        rrHistogram={filters.rrHistogram}
        mfeHistogram={filters.mfeHistogram}
        maeHistogram={filters.maeHistogram}
        efficiencyHistogram={filters.efficiencyHistogram}
      />
    </div>
  );

  const sharedControls = (
    <>
      {onViewChange ? (
        <ViewSwitcher
          selectedViewId={selectedViewId}
          onViewChange={onViewChange}
          onManageViews={onManageViews}
          accountId={accountId || null}
        />
      ) : null}

      <TradesToolbarGroupControl
        groupBy={groupBy}
        onGroupByChange={onGroupByChange}
      />

      {!isMobile ? <TradesToolbarAppliedFilters filters={appliedFilters} /> : null}

      <TradesToolbarSortControls
        sortBadge={sortBadge}
        onSortChange={onSortChange}
        onClearSort={onClearSort}
      />

      <TradesToolbarDisplayControls
        pnlMode={pnlMode}
        onPnlModeChange={onPnlModeChange}
        baselineInitialBalance={baselineInitialBalance}
        ddMode={ddMode}
        onDdModeChange={onDdModeChange}
        table={table}
        tableId={tableId}
      />
    </>
  );

  return (
    <div className="w-full py-2 px-[1px] space-y-2">
      <div className="flex w-full items-center gap-2">
        {searchInput}
        {isMobile ? (
          <Button
            type="button"
            className="h-[38px] rounded-sm bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent"
            onClick={() => setShowMobileTools((current) => !current)}
          >
            <SlidersHorizontal className="mr-1.5 size-3.5" />
            More
          </Button>
        ) : null}
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {appliedFilters.length ? (
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2">
                <TradesToolbarAppliedFilters filters={appliedFilters} />
              </div>
            </div>
          ) : null}
          {showMobileTools ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/5 bg-sidebar/60 p-3">
              {sharedControls}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">{sharedControls}</div>
        </div>
      )}
    </div>
  );
}
