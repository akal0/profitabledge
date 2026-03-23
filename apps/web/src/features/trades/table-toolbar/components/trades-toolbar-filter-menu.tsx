"use client";

import * as React from "react";
import { ListFilterPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DateRangeFilter from "@/components/ui/date-range-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import RangeSlider from "@/components/slider";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  DirectionPill,
  KillzonePill,
  ModelTagPill,
  OutcomePill,
  ProtocolPill,
  TagPill,
} from "../lib/trades-toolbar-pills";
import { tradesToolbarStyles } from "../lib/trades-toolbar-styles";
import {
  ALL_OUTCOME_FILTER_VALUES,
  type OutcomeFilterValue,
  type StatFilters,
  type TagFilterOption,
} from "../lib/trades-toolbar-types";
import {
  formatTriggerLabel,
  getHistogramBounds,
} from "../lib/trades-toolbar-utils";

function SelectionSubmenu({
  triggerLabel,
  label,
  items,
  selectedValues,
  onSelectedValuesChange,
  onApply,
  renderItem,
  getKey,
  clearLabel = "Clear",
  applyLabel = "Apply",
}: {
  triggerLabel: string;
  label: string;
  items: string[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
  onApply: (values: string[]) => void;
  renderItem?: (item: string) => React.ReactNode;
  getKey?: (item: string) => string;
  clearLabel?: string;
  applyLabel?: string;
}) {
  const {
    filterMenuSubContentClass,
    filterMenuLabelClass,
    filterMenuSubSeparatorClass,
    filterMenuScrollableBodyClass,
    filterMenuOptionRowClass,
    filterMenuCheckboxClass,
    filterMenuFooterClass,
    filterMenuActionButtonClass,
    filterMenuTriggerClass,
  } = tradesToolbarStyles;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
        {triggerLabel}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className={cn(filterMenuSubContentClass, "w-[280px]")}
      >
        <DropdownMenuLabel className={filterMenuLabelClass}>
          {label}
        </DropdownMenuLabel>
        <Separator className={filterMenuSubSeparatorClass} />
        <div className={filterMenuScrollableBodyClass}>
          {items.map((item) => {
            const selected = selectedValues.includes(item);
            return (
              <label
                key={getKey ? getKey(item) : item}
                className={cn(
                  filterMenuOptionRowClass,
                  selected && "bg-sidebar-accent/40"
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedValues);
                    if (checked) {
                      next.add(item);
                    } else {
                      next.delete(item);
                    }
                    onSelectedValuesChange(Array.from(next));
                  }}
                  className={filterMenuCheckboxClass}
                />
                {renderItem ? (
                  renderItem(item)
                ) : (
                  <span className="text-white/75">{item}</span>
                )}
              </label>
            );
          })}
        </div>
        <Separator className={filterMenuSubSeparatorClass} />
        <div className={filterMenuFooterClass}>
          <Button
            className={filterMenuActionButtonClass}
            onClick={(event) => {
              event.stopPropagation();
              onSelectedValuesChange([]);
            }}
          >
            {clearLabel}
          </Button>
          <Button
            className={filterMenuActionButtonClass}
            onClick={(event) => {
              event.stopPropagation();
              onApply(selectedValues);
            }}
          >
            {applyLabel}
          </Button>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

type TradesToolbarFilterMenuProps = {
  appliedFilterCount: number;
  minDate: Date;
  maxDate: Date;
  start?: Date;
  end?: Date;
  onRangeChange: (start?: Date, end?: Date) => void;
  tradeDirection?: "all" | "long" | "short";
  onDirectionChange: (direction: "all" | "long" | "short") => void;
  symbols: string[];
  onSymbolsChange: (symbols: string[]) => void;
  allSymbols?: string[];
  symbolCounts?: Record<string, number>;
  symbolTotal?: number;
  holdMin?: number;
  holdMax?: number;
  holdHistogram?: number[];
  onHoldCommit?: (min: number, max: number) => void;
  volumeMin?: number;
  volumeMax?: number;
  volumeHistogram?: number[];
  onVolumeCommit?: (min: number, max: number) => void;
  profitMin?: number;
  profitMax?: number;
  profitHistogram?: number[];
  onProfitCommit?: (min: number, max: number) => void;
  commissionsMin?: number;
  commissionsMax?: number;
  commissionsHistogram?: number[];
  onCommissionsCommit?: (min: number, max: number) => void;
  swapMin?: number;
  swapMax?: number;
  swapHistogram?: number[];
  onSwapCommit?: (min: number, max: number) => void;
  killzones: string[];
  onKillzonesChange: (killzones: string[]) => void;
  allKillzones?: TagFilterOption[];
  sessionTags: string[];
  onSessionTagsChange: (sessionTags: string[]) => void;
  allSessionTags?: TagFilterOption[];
  modelTags: string[];
  onModelTagsChange: (modelTags: string[]) => void;
  allModelTags?: TagFilterOption[];
  protocolAlignments: string[];
  onProtocolAlignmentsChange: (protocolAlignments: string[]) => void;
  outcomes: string[];
  onOutcomesChange: (outcomes: string[]) => void;
  statFilters: StatFilters;
  setStatFilters: React.Dispatch<React.SetStateAction<StatFilters>>;
  onStatFiltersApply?: (filters?: StatFilters) => void;
  rrHistogram?: number[];
  mfeHistogram?: number[];
  maeHistogram?: number[];
  efficiencyHistogram?: number[];
};

export function TradesToolbarFilterMenu({
  appliedFilterCount,
  minDate,
  maxDate,
  start,
  end,
  onRangeChange,
  tradeDirection,
  onDirectionChange,
  symbols,
  onSymbolsChange,
  allSymbols,
  symbolCounts,
  symbolTotal,
  holdMin,
  holdMax,
  holdHistogram,
  onHoldCommit,
  volumeMin,
  volumeMax,
  volumeHistogram,
  onVolumeCommit,
  profitMin,
  profitMax,
  profitHistogram,
  onProfitCommit,
  commissionsMin,
  commissionsMax,
  commissionsHistogram,
  onCommissionsCommit,
  swapMin,
  swapMax,
  swapHistogram,
  onSwapCommit,
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
  statFilters,
  setStatFilters,
  onStatFiltersApply,
  rrHistogram,
  mfeHistogram,
  maeHistogram,
  efficiencyHistogram,
}: TradesToolbarFilterMenuProps) {
  const [stagedSymbols, setStagedSymbols] = React.useState<string[]>(symbols);
  const [stagedKillzones, setStagedKillzones] =
    React.useState<string[]>(killzones);
  const [stagedSessionTags, setStagedSessionTags] =
    React.useState<string[]>(sessionTags);
  const [stagedModelTags, setStagedModelTags] =
    React.useState<string[]>(modelTags);
  const [stagedProtocol, setStagedProtocol] =
    React.useState<string[]>(protocolAlignments);
  const [stagedOutcomes, setStagedOutcomes] =
    React.useState<string[]>(outcomes);

  React.useEffect(() => {
    setStagedSymbols(symbols);
  }, [symbols]);

  React.useEffect(() => {
    setStagedKillzones(killzones);
  }, [killzones]);

  React.useEffect(() => {
    setStagedSessionTags(sessionTags);
  }, [sessionTags]);

  React.useEffect(() => {
    setStagedModelTags(modelTags);
  }, [modelTags]);

  React.useEffect(() => {
    setStagedProtocol(protocolAlignments);
  }, [protocolAlignments]);

  React.useEffect(() => {
    setStagedOutcomes(outcomes);
  }, [outcomes]);

  const stagedSymbolCount = React.useMemo(() => {
    if (!symbolCounts) return stagedSymbols.length || 0;
    if (!stagedSymbols.length) return symbolTotal || 0;
    return stagedSymbols.reduce(
      (sum, symbol) => sum + (symbolCounts[symbol] || 0),
      0
    );
  }, [stagedSymbols, symbolCounts, symbolTotal]);

  const numericFilterSpikes = React.useMemo(
    () => Array.from({ length: 24 }, (_, index) => (index + 1) / 25),
    []
  );

  const {
    activeBadgeClass,
    filterMenuContentClass,
    filterMenuSectionTitleClass,
    filterMenuMainSeparatorClass,
    filterMenuSubContentClass,
    filterMenuTriggerClass,
    iconBadgeClass,
    selectMenuItemClass,
  } = tradesToolbarStyles;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "relative",
            iconBadgeClass,
            appliedFilterCount > 0 && activeBadgeClass,
            "ring-0 bg-transparent rounded-none hover:bg-transparent"
          )}
          aria-label={
            appliedFilterCount > 0
              ? `Filters applied: ${appliedFilterCount}`
              : "Open filters"
          }
        >
          <ListFilterPlus className="size-4 text-white/60 hover:text-white" />
          {appliedFilterCount > 0 ? (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-teal-400" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className={filterMenuContentClass}>
        <div className={filterMenuSectionTitleClass}>Filters</div>
        <Separator className={filterMenuMainSeparatorClass} />

        <div className="mt-1">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
              Date
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className={cn(filterMenuSubContentClass, "w-[320px] p-4")}
            >
              <DateRangeFilter
                minDate={minDate}
                maxDate={maxDate}
                valueStart={start}
                valueEnd={end}
                onChange={(nextStart, nextEnd) =>
                  onRangeChange(nextStart, nextEnd)
                }
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </div>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
            Direction
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            className={cn(filterMenuSubContentClass, "w-[220px] p-1")}
          >
            <DropdownMenuItem
              onSelect={() => onDirectionChange("all")}
              className={selectMenuItemClass}
            >
              All
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDirectionChange("long")}
              className={selectMenuItemClass}
            >
              <DirectionPill direction="long" />
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDirectionChange("short")}
              className={selectMenuItemClass}
            >
              <DirectionPill direction="short" />
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
            Hold time
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            className={cn(filterMenuSubContentClass, "w-[450px] p-2")}
          >
            <RangeSlider
              label=""
              min={0}
              max={Math.max(60, ...(holdHistogram || []))}
              defaultValue={[
                holdMin ?? 0,
                holdMax ?? Math.max(60, ...(holdHistogram || [])),
              ]}
              histogramData={holdHistogram || []}
              bins={180}
              spikePositions={Array.from({ length: 28 }, (_, index) =>
                Math.min(
                  0.995,
                  Math.max(
                    0.005,
                    (index + 1) / 29 +
                      ((Math.sin((index + 1) * 7.77) + 1) / 2 - 0.5) * (1 / 30)
                  )
                )
              )}
              baseBarPct={6}
              spikeBarPct={72}
              showCountButton
              countLabel={(count) => `Show ${count} trades`}
              onCountButtonClick={([low, high]) => onHoldCommit?.(low, high)}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <SelectionSubmenu
          triggerLabel={formatTriggerLabel("Symbol", stagedSymbols.length)}
          label="Select symbols"
          items={allSymbols || []}
          selectedValues={stagedSymbols}
          onSelectedValuesChange={setStagedSymbols}
          onApply={onSymbolsChange}
          applyLabel={`Show ${stagedSymbolCount} trades`}
          renderItem={(symbol) => (
            <span className="select-none tracking-wide text-white/75">
              {symbol}
            </span>
          )}
        />

        {[
          {
            label: "Volume",
            min: 0,
            max: Math.max(1, ...(volumeHistogram || [1])),
            defaultValue: [
              volumeMin ?? 0,
              volumeMax ?? Math.max(1, ...(volumeHistogram || [1])),
            ] as [number, number],
            histogram: volumeHistogram || [],
            onCommit: onVolumeCommit,
            minInputLabel: "Minimum volume",
            maxInputLabel: "Maximum volume",
          },
          {
            label: "Profit and loss",
            min: Math.min(0, ...(profitHistogram || [0])),
            max: Math.max(0, ...(profitHistogram || [0])),
            defaultValue: [
              profitMin ?? Math.min(0, ...(profitHistogram || [0])),
              profitMax ?? Math.max(0, ...(profitHistogram || [0])),
            ] as [number, number],
            histogram: profitHistogram || [],
            onCommit: onProfitCommit,
            prefix: "$",
            minInputLabel: "Minimum profit and loss",
            maxInputLabel: "Maximum profit and loss",
          },
          {
            label: "Commissions",
            min: Math.min(0, ...(commissionsHistogram || [0])),
            max: Math.max(0, ...(commissionsHistogram || [0])),
            defaultValue: [
              commissionsMin ?? Math.min(0, ...(commissionsHistogram || [0])),
              commissionsMax ?? Math.max(0, ...(commissionsHistogram || [0])),
            ] as [number, number],
            histogram: commissionsHistogram || [],
            onCommit: onCommissionsCommit,
            prefix: "$",
            minInputLabel: "Minimum commissions",
            maxInputLabel: "Maximum commissions",
          },
          {
            label: "Swap",
            min: Math.min(0, ...(swapHistogram || [0])),
            max: Math.max(0, ...(swapHistogram || [0])),
            defaultValue: [
              swapMin ?? Math.min(0, ...(swapHistogram || [0])),
              swapMax ?? Math.max(0, ...(swapHistogram || [0])),
            ] as [number, number],
            histogram: swapHistogram || [],
            onCommit: onSwapCommit,
            prefix: "$",
            minInputLabel: "Minimum swap",
            maxInputLabel: "Maximum swap",
          },
        ].map((item) => (
          <DropdownMenuSub key={item.label}>
            <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
              {item.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
            >
              <RangeSlider
                label=""
                mode="number"
                min={item.min}
                max={item.max}
                prefix={item.prefix}
                defaultValue={item.defaultValue}
                histogramData={item.histogram}
                bins={180}
                spikePositions={numericFilterSpikes}
                baseBarPct={6}
                spikeBarPct={72}
                minInputLabel={item.minInputLabel}
                maxInputLabel={item.maxInputLabel}
                showCountButton
                countLabel={(count) => `Show ${count} trades`}
                onCountButtonClick={([low, high]) => item.onCommit?.(low, high)}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}

        <SelectionSubmenu
          triggerLabel={formatTriggerLabel("Killzone", stagedKillzones.length)}
          label="Select killzones"
          items={(allKillzones || []).map((option) => option.name)}
          selectedValues={stagedKillzones}
          onSelectedValuesChange={setStagedKillzones}
          onApply={onKillzonesChange}
          renderItem={(value) => {
            const option = allKillzones?.find((item) => item.name === value);
            return <KillzonePill label={value} color={option?.color} />;
          }}
        />

        <SelectionSubmenu
          triggerLabel={formatTriggerLabel(
            "Session tag",
            stagedSessionTags.length
          )}
          label="Select session tags"
          items={(allSessionTags || []).map((option) => option.name)}
          selectedValues={stagedSessionTags}
          onSelectedValuesChange={setStagedSessionTags}
          onApply={onSessionTagsChange}
          renderItem={(value) => {
            const option = allSessionTags?.find((item) => item.name === value);
            return <TagPill label={value} color={option?.color} />;
          }}
        />

        <SelectionSubmenu
          triggerLabel={formatTriggerLabel("Edge", stagedModelTags.length)}
          label="Select Edges"
          items={(allModelTags || []).map((option) => option.name)}
          selectedValues={stagedModelTags}
          onSelectedValuesChange={setStagedModelTags}
          onApply={onModelTagsChange}
          renderItem={(value) => {
            const option = allModelTags?.find((item) => item.name === value);
            return <ModelTagPill label={value} color={option?.color} />;
          }}
        />

        <SelectionSubmenu
          triggerLabel={formatTriggerLabel(
            "Protocol alignment",
            stagedProtocol.length
          )}
          label="Select protocol alignment"
          items={["aligned", "against", "discretionary"]}
          selectedValues={stagedProtocol}
          onSelectedValuesChange={setStagedProtocol}
          onApply={onProtocolAlignmentsChange}
          renderItem={(value) => (
            <ProtocolPill
              value={value as "aligned" | "against" | "discretionary"}
            />
          )}
        />

        <div className="mb-1">
          <SelectionSubmenu
            triggerLabel={formatTriggerLabel("Outcome", stagedOutcomes.length)}
            label="Select outcomes"
            items={ALL_OUTCOME_FILTER_VALUES}
            selectedValues={stagedOutcomes}
            onSelectedValuesChange={setStagedOutcomes}
            onApply={onOutcomesChange}
            renderItem={(value) => (
              <OutcomePill value={value as OutcomeFilterValue} />
            )}
          />
        </div>

        <Separator className={filterMenuMainSeparatorClass} />
        <div className={filterMenuSectionTitleClass}>Statistical filters</div>
        <Separator className={filterMenuMainSeparatorClass} />

        {[
          {
            label: "R:R range",
            histogram: rrHistogram,
            bounds: getHistogramBounds(rrHistogram, {
              minFloor: 0,
              maxFloor: 0,
            }),
            value: [
              statFilters.rrMin ??
                getHistogramBounds(rrHistogram, {
                  minFloor: 0,
                  maxFloor: 0,
                })[0],
              statFilters.rrMax ??
                getHistogramBounds(rrHistogram, {
                  minFloor: 0,
                  maxFloor: 0,
                })[1],
            ] as [number, number],
            minInputLabel: "Minimum realised R:R",
            maxInputLabel: "Maximum realised R:R",
            onChange: ([low, high]: [number, number]) =>
              setStatFilters((current) => ({
                ...current,
                rrMin: low,
                rrMax: high,
              })),
            onApply: ([low, high]: [number, number]) => {
              const next = { ...statFilters, rrMin: low, rrMax: high };
              setStatFilters(next);
              onStatFiltersApply?.(next);
            },
          },
          {
            label: "MFE range",
            histogram: mfeHistogram,
            bounds: getHistogramBounds(mfeHistogram, {
              minFloor: 0,
              maxFloor: 0,
            }),
            value: [
              statFilters.mfeMin ??
                getHistogramBounds(mfeHistogram, {
                  minFloor: 0,
                  maxFloor: 0,
                })[0],
              statFilters.mfeMax ??
                getHistogramBounds(mfeHistogram, {
                  minFloor: 0,
                  maxFloor: 0,
                })[1],
            ] as [number, number],
            minInputLabel: "Minimum MFE",
            maxInputLabel: "Maximum MFE",
            onChange: ([low, high]: [number, number]) =>
              setStatFilters((current) => ({
                ...current,
                mfeMin: low,
                mfeMax: high,
              })),
            onApply: ([low, high]: [number, number]) => {
              const next = { ...statFilters, mfeMin: low, mfeMax: high };
              setStatFilters(next);
              onStatFiltersApply?.(next);
            },
          },
          {
            label: "MAE range",
            histogram: maeHistogram,
            bounds: getHistogramBounds(maeHistogram, {
              minFloor: 0,
              maxFloor: 0,
            }),
            value: [
              statFilters.maeMin ??
                getHistogramBounds(maeHistogram, {
                  minFloor: 0,
                  maxFloor: 0,
                })[0],
              statFilters.maeMax ??
                getHistogramBounds(maeHistogram, {
                  minFloor: 0,
                  maxFloor: 0,
                })[1],
            ] as [number, number],
            minInputLabel: "Minimum MAE",
            maxInputLabel: "Maximum MAE",
            onChange: ([low, high]: [number, number]) =>
              setStatFilters((current) => ({
                ...current,
                maeMin: low,
                maeMax: high,
              })),
            onApply: ([low, high]: [number, number]) => {
              const next = { ...statFilters, maeMin: low, maeMax: high };
              setStatFilters(next);
              onStatFiltersApply?.(next);
            },
          },
          {
            label: "Efficiency range",
            histogram: efficiencyHistogram,
            bounds: getHistogramBounds(efficiencyHistogram, {
              minFloor: 0,
              maxFloor: 100,
              fallbackMin: 0,
              fallbackMax: 100,
            }),
            value: [
              statFilters.efficiencyMin ??
                getHistogramBounds(efficiencyHistogram, {
                  minFloor: 0,
                  maxFloor: 100,
                  fallbackMin: 0,
                  fallbackMax: 100,
                })[0],
              statFilters.efficiencyMax ??
                getHistogramBounds(efficiencyHistogram, {
                  minFloor: 0,
                  maxFloor: 100,
                  fallbackMin: 0,
                  fallbackMax: 100,
                })[1],
            ] as [number, number],
            minInputLabel: "Minimum efficiency",
            maxInputLabel: "Maximum efficiency",
            suffix: "%",
            onChange: ([low, high]: [number, number]) =>
              setStatFilters((current) => ({
                ...current,
                efficiencyMin: low,
                efficiencyMax: high,
              })),
            onApply: ([low, high]: [number, number]) => {
              const next = {
                ...statFilters,
                efficiencyMin: low,
                efficiencyMax: high,
              };
              setStatFilters(next);
              onStatFiltersApply?.(next);
            },
          },
        ].map((item, index) => (
          <div key={item.label} className={cn(index === 0 && "mt-1")}>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                {item.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
              >
                <RangeSlider
                  label=""
                  mode="number"
                  min={item.bounds[0]}
                  max={item.bounds[1]}
                  value={item.value}
                  histogramData={item.histogram || []}
                  bins={180}
                  spikePositions={numericFilterSpikes}
                  baseBarPct={6}
                  spikeBarPct={72}
                  minInputLabel={item.minInputLabel}
                  maxInputLabel={item.maxInputLabel}
                  suffix={item.suffix}
                  showCountButton
                  countLabel={(count) => `Show ${count} trades`}
                  disabled={!item.histogram?.length}
                  onChange={(range) => item.onChange(range as [number, number])}
                  onCountButtonClick={(range) =>
                    item.onApply(range as [number, number])
                  }
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
