"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedCallback } from "use-debounce";
import { cn } from "@/lib/utils";
import {
  Select as ShSelect,
  SelectTrigger as ShSelectTrigger,
  SelectContent as ShSelectContent,
  SelectItem as ShSelectItem,
  SelectValue as ShSelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useDateRangeStore } from "@/stores/date-range";
import TradeMultiSelect from "@/components/trade-multi-select";
import { ChevronDown, ListFilterPlus, ArrowUpDown, Funnel } from "lucide-react";
import DateRangeFilter from "@/components/ui/date-range-filter";
import RangeSlider from "@/components/slider";
import type { Table } from "@tanstack/react-table";
import { trpcClient } from "@/utils/trpc";

export interface TradesToolbarProps {
  q: string;
  table: Table<any>;
  tableId?: string;
  onQChange: (q: string) => void;
  tradeDirection?: "all" | "long" | "short";
  onDirectionChange: (d: "all" | "long" | "short") => void;
  symbols: string[];
  onSymbolsChange: (s: string[]) => void;
  allSymbols?: string[];
  symbolCounts?: Record<string, number>;
  symbolTotal?: number;
  sortValue?: string;
  start?: Date;
  end?: Date;
  minBound?: Date;
  maxBound?: Date;
  onRangeChange: (start?: Date, end?: Date) => void;
  holdMin?: number;
  holdMax?: number;
  holdHistogram?: number[];
  onHoldCommit?: (min: number, max: number) => void;
  onHoldClear?: () => void;
  volumeMin?: number;
  volumeMax?: number;
  volumeHistogram?: number[];
  onVolumeCommit?: (min: number, max: number) => void;
  onVolumeClear?: () => void;
  profitMin?: number;
  profitMax?: number;
  profitHistogram?: number[];
  onProfitCommit?: (min: number, max: number) => void;
  onProfitClear?: () => void;
  commissionsMin?: number;
  commissionsMax?: number;
  commissionsHistogram?: number[];
  onCommissionsCommit?: (min: number, max: number) => void;
  onCommissionsClear?: () => void;
  swapMin?: number;
  swapMax?: number;
  swapHistogram?: number[];
  onSwapCommit?: (min: number, max: number) => void;
  onSwapClear?: () => void;
  ddMode?: "pips" | "percent" | "usd";
  onDdModeChange?: (m: "pips" | "percent" | "usd") => void;
  dukaDebug?: boolean;
  onDukaDebugChange?: (enabled: boolean) => void;
}

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
  sortValue,
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
  ddMode,
  onDdModeChange,
  dukaDebug,
  onDukaDebugChange,
}: TradesToolbarProps) {
  const [symInput, setSymInput] = React.useState("");
  const debouncedQ = useDebouncedCallback(onQChange, 300);
  const { min, max } = useDateRangeStore();
  React.useEffect(() => {
    setStagedSymbols(symbols);
  }, [symbols]);
  const [symbolPopoverOpen, setSymbolPopoverOpen] = React.useState(false);
  const [stagedSymbols, setStagedSymbols] = React.useState<string[]>(symbols);

  React.useEffect(() => {
    if (symbolPopoverOpen) {
      setStagedSymbols(symbols);
    }
  }, [symbolPopoverOpen]);

  const stagedCount = React.useMemo(() => {
    if (!symbolCounts) return stagedSymbols.length || 0;
    if (!stagedSymbols.length) return symbolTotal || 0;
    return stagedSymbols.reduce((sum, s) => sum + (symbolCounts[s] || 0), 0);
  }, [stagedSymbols, symbolCounts, symbolTotal]);

  const sortBadge = React.useMemo(() => {
    if (!sortValue || sortValue === "open:desc") return "";
    const map: Record<string, string> = {
      "open:desc": "Newest opens first",
      "open:asc": "Oldest opens first",
      "close:desc": "Newest closes first",
      "close:asc": "Oldest closes first",
      "profit:desc": "Highest P/L first",
      "profit:asc": "Lowest P/L first",
      "volume:desc": "Most volume first",
      "volume:asc": "Least volume first",
      "holdSeconds:desc": "Longest holds first",
      "holdSeconds:asc": "Shortest holds first",
      "commissions:desc": "Highest fees first",
      "commissions:asc": "Lowest fees first",
      "swap:desc": "Highest swap first",
      "swap:asc": "Lowest swap first",
      "symbol:asc": "A→Z symbols",
      "symbol:desc": "Z→A symbols",
      "tradeDirection:asc": "Longs first",
      "tradeDirection:desc": "Shorts first",
    };
    if (sortValue && map[sortValue]) return map[sortValue];
    const [id, dir] = sortValue.split(":");
    if (id === "symbol") return dir === "asc" ? "A→Z symbols" : "Z→A symbols";
    if (id === "tradeDirection")
      return dir === "asc" ? "Longs first" : "Shorts first";
    const name =
      id === "open"
        ? "opens"
        : id === "close"
        ? "closes"
        : id === "profit"
        ? "P/L"
        : id === "volume"
        ? "volume"
        : id === "holdSeconds"
        ? "holds"
        : id === "commissions"
        ? "fees"
        : id === "swap"
        ? "swap"
        : id;
    const phrase =
      dir === "asc" ? `Lowest ${name} first` : `Highest ${name} first`;
    return phrase;
  }, [sortValue]);

  const formatRangeLabel = React.useCallback(() => {
    if (!start || !end) return "All time";
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    return `${fmt(start)} - ${fmt(end)}`;
  }, [start, end]);

  // Sorting popover state
  const [sortOpen, setSortOpen] = React.useState(false);
  const [stagedSort, setStagedSort] = React.useState<string>("open:desc");

  const applyPreset = (days: number | "all") => {
    if (days === "all") {
      onRangeChange(undefined, undefined);
      return;
    }
    const maxDate = (maxBound as Date) || (max as Date) || new Date();
    const endJs = new Date(maxDate);
    endJs.setHours(0, 0, 0, 0);
    const startJs = new Date(endJs);
    startJs.setDate(endJs.getDate() - (days - 1));
    const minDate = (minBound as Date) || (min as Date) || startJs;
    const clampedStart =
      startJs < (minDate as Date) ? new Date(minDate) : startJs;
    onRangeChange(clampedStart, endJs);
  };

  const formatHuman = (d: Date) => {
    const day = d.getDate();
    const j = day % 10;
    const k = day % 100;
    const suf =
      j === 1 && k !== 11
        ? "st"
        : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
        ? "rd"
        : "th";
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day}${suf} ${month}' ${year}`;
  };
  const formatDuration = (totalSec: number) => {
    const s = Math.max(0, Math.floor(totalSec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${sec}s`);
    return parts.join(" ");
  };
  const formatHoldBadge = (
    minSec?: number,
    maxSec?: number,
    hist?: number[]
  ) => {
    if (typeof minSec !== "number" || typeof maxSec !== "number") return "";
    const hasHist = Array.isArray(hist) && hist.length > 0;
    const minBound = hasHist ? Math.min(...hist!) : 0;
    const maxBound = hasHist ? Math.max(...hist!) : Math.max(maxSec, 0);
    const slack = 60; // seconds tolerance to consider reaching bounds
    const atLower = minSec <= minBound + slack;
    const atUpper = maxSec >= maxBound - slack;
    if (atLower && atUpper) return "Hold time: All times";
    if (atLower && !atUpper) return `Hold time: ≤ ${formatDuration(maxSec)}`;
    if (!atLower && atUpper) return `Hold time: ≥ ${formatDuration(minSec)}`;

    return `Hold time: ${formatDuration(minSec)} - ${formatDuration(maxSec)}`;
  };

  const formatNumeric = (n: number, prefix?: string) => {
    const abs = Math.abs(n).toLocaleString();
    const sign = n < 0 ? "-" : "";
    return `${sign}${prefix || ""}${abs}`;
  };
  const formatNumBadge = (
    label: string,
    minVal?: number,
    maxVal?: number,
    hist?: number[],
    prefix?: string
  ) => {
    if (typeof minVal !== "number" || typeof maxVal !== "number") return "";
    const hasHist = Array.isArray(hist) && hist.length > 0;
    const minB = hasHist ? Math.min(...hist!) : minVal;
    const maxB = hasHist ? Math.max(...hist!) : maxVal;
    const slack = Math.max(1, Math.round((maxB - minB) * 0.01));
    const atLower = minVal <= minB + slack;
    const atUpper = maxVal >= maxB - slack;
    if (atLower && atUpper) return `${label}: All`;
    if (atLower && !atUpper)
      return `${label}: ≤ ${formatNumeric(maxVal, prefix)}`;
    if (!atLower && atUpper)
      return `${label}: ≥ ${formatNumeric(minVal, prefix)}`;
    return `${label}: ${formatNumeric(minVal, prefix)} - ${formatNumeric(
      maxVal,
      prefix
    )}`;
  };

  return (
    <div className="flex justify-between w-full items-center gap-2 py-2">
      <div className="flex items-center gap-2">
        <div className="flex w-128 items-center border border-white/5 pl-8 pr-2 group hover:bg-sidebar-accent transition duration-250 relative">
          <Input
            placeholder="Search (symbol)"
            defaultValue={q}
            onChange={(e) => debouncedQ(e.target.value)}
            className="h-max py-4 text-xs focus-visible:scale-100 px-0 border-none hover:none group-hover:bg-sidebar-accent hover:brightness-100"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className=" text-[11px] bg-transparent hover:bg-sidebar-accent hover:bg-transparent">
                <ListFilterPlus className="text-white/60 size-4 hover:text-white " />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="rounded-none bg-sidebar border border-white/5 w-[300px] p-1 -mr-[9px]"
            >
              <DropdownMenuSub>
                <h1 className="text-xs text-white/60 px-4 py-2.5"> Filters</h1>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Date</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-4">
                  <DateRangeFilter
                    minDate={minBound || min || new Date(0)}
                    maxDate={maxBound || max || new Date()}
                    valueStart={start}
                    valueEnd={end}
                    onChange={(s, e) => onRangeChange?.(s, e)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Direction</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-1 w-[220px]">
                  <DropdownMenuItem
                    onSelect={() => onDirectionChange("all")}
                    className="px-4 py-2.5"
                  >
                    All
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => onDirectionChange("long")}
                    className="px-4 py-2.5"
                  >
                    Long
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => onDirectionChange("short")}
                    className="px-4 py-2.5"
                  >
                    Short
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Hold time</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-2 w-[450px]">
                  {(() => {
                    const spikes = Array.from({ length: 28 }, (_, i) => {
                      const base = (i + 1) / 29;
                      const jitter =
                        ((Math.sin((i + 1) * 7.77) + 1) / 2 - 0.5) * (1 / 30);
                      return Math.min(0.995, Math.max(0.005, base + jitter));
                    });
                    const countLabel = (count: number) =>
                      `Show ${count} trades`;
                    return (
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
                        spikePositions={spikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        showCountButton
                        countLabel={countLabel}
                        onCountButtonClick={([lo, hi]) =>
                          onHoldCommit?.(lo, hi)
                        }
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Symbol</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-2 w-[280px]">
                  <DropdownMenuLabel className="px-2 pb-2 text-[12px] font-normal text-white/60">
                    Select symbols
                  </DropdownMenuLabel>
                  <div className="max-h-64 overflow-auto pr-1">
                    {(allSymbols || []).map((sym) => {
                      const selected = stagedSymbols.includes(sym);
                      return (
                        <label
                          key={sym}
                          className="flex items-center gap-2 px-1 py-1.5 text-xs"
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedSymbols);
                              if (v) next.add(sym);
                              else next.delete(sym);
                              setStagedSymbols(Array.from(next));
                            }}
                            className="rounded-none border-white/5 cursor-pointer hover:brightness-120 data-[state=checked]:brightness-120"
                          />
                          <span className="select-none">{sym}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="pt-3 flex gap-2">
                    <Button
                      className="flex-1 border border-white/5 bg-sidebar hover:bg-sidebar-accent rounded-none text-xs text-white py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedSymbols([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className="flex-1 border border-white/5 bg-sidebar hover:bg-sidebar-accent rounded-none text-xs text-white py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSymbolsChange(stagedSymbols);
                      }}
                    >
                      {`Show ${stagedCount} trades`}
                    </Button>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Volume</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-2 w-[360px]">
                  {(() => {
                    const spikes = Array.from(
                      { length: 24 },
                      (_, i) => (i + 1) / 25
                    );
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={0}
                        max={Math.max(1, ...(volumeHistogram || [1]))}
                        defaultValue={[
                          volumeMin ?? 0,
                          volumeMax ?? Math.max(1, ...(volumeHistogram || [1])),
                        ]}
                        histogramData={volumeHistogram || []}
                        bins={180}
                        spikePositions={spikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum volume"
                        maxInputLabel="Maximum volume"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        onCountButtonClick={([lo, hi]) =>
                          onVolumeCommit?.(lo, hi)
                        }
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>P/L</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-2 w-[360px]">
                  {(() => {
                    const spikes = Array.from(
                      { length: 24 },
                      (_, i) => (i + 1) / 25
                    );
                    const minH = Math.min(0, ...(profitHistogram || [0]));
                    const maxH = Math.max(0, ...(profitHistogram || [0]));
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={minH}
                        max={maxH}
                        prefix="$"
                        defaultValue={[profitMin ?? minH, profitMax ?? maxH]}
                        histogramData={profitHistogram || []}
                        bins={180}
                        spikePositions={spikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum P/L"
                        maxInputLabel="Maximum P/L"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        onCountButtonClick={([lo, hi]) =>
                          onProfitCommit?.(lo, hi)
                        }
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Commissions</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-2 w-[360px]">
                  {(() => {
                    const spikes = Array.from(
                      { length: 24 },
                      (_, i) => (i + 1) / 25
                    );
                    const minH = Math.min(0, ...(commissionsHistogram || [0]));
                    const maxH = Math.max(0, ...(commissionsHistogram || [0]));
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={minH}
                        max={maxH}
                        prefix="$"
                        defaultValue={[
                          commissionsMin ?? minH,
                          commissionsMax ?? maxH,
                        ]}
                        histogramData={commissionsHistogram || []}
                        bins={180}
                        spikePositions={spikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum commissions"
                        maxInputLabel="Maximum commissions"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        onCountButtonClick={([lo, hi]) =>
                          onCommissionsCommit?.(lo, hi)
                        }
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Swap</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-2 w-[360px]">
                  {(() => {
                    const spikes = Array.from(
                      { length: 24 },
                      (_, i) => (i + 1) / 25
                    );
                    const minH = Math.min(0, ...(swapHistogram || [0]));
                    const maxH = Math.max(0, ...(swapHistogram || [0]));
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={minH}
                        max={maxH}
                        prefix="$"
                        defaultValue={[swapMin ?? minH, swapMax ?? maxH]}
                        histogramData={swapHistogram || []}
                        bins={180}
                        spikePositions={spikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum swap"
                        maxInputLabel="Maximum swap"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        onCountButtonClick={([lo, hi]) =>
                          onSwapCommit?.(lo, hi)
                        }
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {start && end ? (
          <Button
            className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent"
            onClick={() => onRangeChange?.(undefined, undefined)}
          >
            Date: {formatHuman(start)} - {formatHuman(end)}{" "}
            <span className="ml-2">×</span>
          </Button>
        ) : null}

        {(tradeDirection ?? "all") !== "all" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="border border-white/5 px-3 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent">
                {tradeDirection === "long" ? "Longs only" : "Shorts only"}
                <span className="">
                  <ChevronDown className="size-4 text-white/50" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="rounded-none bg-sidebar border border-white/5 p-1 w-[220px]"
            >
              <DropdownMenuItem
                className="px-4 py-2.5"
                onSelect={() => onDirectionChange("all")}
              >
                All
              </DropdownMenuItem>
              <DropdownMenuItem
                className="px-4 py-2.5"
                onSelect={() => onDirectionChange("long")}
              >
                Long
              </DropdownMenuItem>
              <DropdownMenuItem
                className="px-4 py-2.5"
                onSelect={() => onDirectionChange("short")}
              >
                Short
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {typeof holdMin === "number" && typeof holdMax === "number" ? (
          <Button
            className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent"
            onClick={() => onHoldClear?.()}
          >
            {formatHoldBadge(holdMin, holdMax, holdHistogram)}{" "}
            <span className="ml-2">×</span>
          </Button>
        ) : null}

        {typeof volumeMin === "number" && typeof volumeMax === "number" ? (
          <Button
            className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent"
            onClick={() => onVolumeClear?.()}
          >
            {formatNumBadge("Volume", volumeMin, volumeMax, volumeHistogram)}{" "}
            <span className="ml-2">×</span>
          </Button>
        ) : null}

        {typeof profitMin === "number" && typeof profitMax === "number" ? (
          <Button
            className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent"
            onClick={() => onProfitClear?.()}
          >
            {formatNumBadge("P/L", profitMin, profitMax, profitHistogram, "$")}{" "}
            <span className="ml-2">×</span>
          </Button>
        ) : null}

        {typeof commissionsMin === "number" &&
        typeof commissionsMax === "number" ? (
          <Button
            className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent"
            onClick={() => onCommissionsClear?.()}
          >
            {formatNumBadge(
              "Commissions",
              commissionsMin,
              commissionsMax,
              commissionsHistogram,
              "$"
            )}{" "}
            <span className="ml-2">×</span>
          </Button>
        ) : null}

        {typeof swapMin === "number" && typeof swapMax === "number" ? (
          <Button
            className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent"
            onClick={() => onSwapClear?.()}
          >
            {formatNumBadge("Swap", swapMin, swapMax, swapHistogram, "$")}{" "}
            <span className="ml-2">×</span>
          </Button>
        ) : null}

        {/* Symbols badge: show only when a subset (not all) is selected */}
        {symbols.length > 0 && symbols.length !== (allSymbols?.length || 0) ? (
          <Popover open={symbolPopoverOpen} onOpenChange={setSymbolPopoverOpen}>
            <PopoverTrigger asChild>
              <Button className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent max-w-[260px] truncate">
                {(() => {
                  const shown = symbols.slice(0, 3).join(", ");
                  const extra = symbols.length - 3;
                  return extra > 0 ? `${shown} +${extra}` : shown;
                })()}
                <span className="ml-1">
                  <ChevronDown className="size-4 text-white/50" />
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="rounded-none bg-sidebar border border-white/5 p-2 w-[280px]">
              <div className="px-2 pb-1 text-[11px] text-white/60">
                Select symbols
              </div>
              <div className="max-h-64 overflow-auto">
                {(allSymbols || []).map((sym) => {
                  const selected = stagedSymbols.includes(sym);
                  return (
                    <label
                      key={sym}
                      className="flex items-center gap-2 px-1 py-1 text-xs"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(v) => {
                          const next = new Set(stagedSymbols);
                          if (v) next.add(sym);
                          else next.delete(sym);
                          setStagedSymbols(Array.from(next));
                        }}
                        className="rounded-none border-white/5 cursor-pointer"
                      />
                      <span
                        className={cn(
                          "select-none cursor-pointer text-white/50 transition duration-250 hover:text-white tracking-wide",
                          selected && "text-white"
                        )}
                      >
                        {sym}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="pt-3 flex gap-2">
                <Button
                  className="flex-1 border border-white/5 bg-sidebar hover:bg-sidebar-accent rounded-none text-xs text-white py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStagedSymbols([]);
                  }}
                >
                  Clear
                </Button>
                <Button
                  className="flex-1 border border-white/5 bg-sidebar hover:bg-sidebar-accent rounded-none text-xs text-white py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSymbolsChange(stagedSymbols);
                    setSymbolPopoverOpen(false);
                  }}
                >
                  {`Show ${stagedCount} trades`}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="border border-white/5 bg-transparent hover:bg-sidebar-accent px-4 py-4 h-max text-xs text-white/70 rounded-none">
              Sort by
              <ChevronDown className="size-3.5 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="rounded-none bg-sidebar border border-white/5 w-[280px] p-1"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Quick sorts</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-1 w-[220px]">
                <DropdownMenuItem
                  className="px-4 py-2.5"
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "open:desc" })
                    )
                  }
                >
                  Latest open
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2.5"
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "open:asc" })
                    )
                  }
                >
                  Earliest open
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2.5"
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "profit:desc" })
                    )
                  }
                >
                  Highest P/L
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2.5"
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "profit:asc" })
                    )
                  }
                >
                  Lowest P/L
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2.5"
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "volume:desc" })
                    )
                  }
                >
                  Highest volume
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2.5"
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", {
                        detail: "holdSeconds:asc",
                      })
                    )
                  }
                >
                  Shortest hold
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2.5"
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", {
                        detail: "holdSeconds:desc",
                      })
                    )
                  }
                >
                  Longest hold
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            {[
              { id: "open", label: "Open" },
              { id: "close", label: "Close" },
              { id: "holdSeconds", label: "Hold time" },
              { id: "symbol", label: "Symbol" },
              { id: "tradeDirection", label: "Direction" },
              { id: "volume", label: "Volume" },
              { id: "profit", label: "P/L" },
              { id: "commissions", label: "Commissions" },
              { id: "swap", label: "Swap" },
            ].map((col) => (
              <DropdownMenuSub key={col.id}>
                <DropdownMenuSubTrigger>{col.label}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-none bg-sidebar border border-white/5 p-1 w-[220px]">
                  <DropdownMenuItem
                    className="px-4 py-2.5"
                    onSelect={() =>
                      globalThis.dispatchEvent(
                        new CustomEvent("apply-sort", {
                          detail: `${col.id}:asc`,
                        })
                      )
                    }
                  >
                    Ascending
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="px-4 py-2.5"
                    onSelect={() =>
                      globalThis.dispatchEvent(
                        new CustomEvent("apply-sort", {
                          detail: `${col.id}:desc`,
                        })
                      )
                    }
                  >
                    Descending
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="px-4 py-2.5"
              onSelect={() =>
                globalThis.dispatchEvent(new CustomEvent("clear-sort"))
              }
            >
              Clear sort
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {sortBadge ? (
          <Button
            className="border border-white/5 px-4 text-xs text-white/70 hover:text-white bg-sidebar rounded-none hover:bg-sidebar-accent"
            onClick={() =>
              globalThis.dispatchEvent(new CustomEvent("clear-sort"))
            }
          >
            {sortBadge} <span className="ml-2">×</span>
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {/* Pips / % / $ toggle */}
        <div className="flex items-center">
          <Button
            className={cn(
              "border border-white/5 border-r-0 px-3 text-xs rounded-none",
              ddMode === "pips"
                ? "bg-sidebar-accent hover:bg-sidebar-accent hover:brightness-120 text-white"
                : "bg-sidebar text-white/25 hover:text-white hover:bg-sidebar-accent"
            )}
            onClick={() => onDdModeChange?.("pips")}
          >
            Pips
          </Button>

          <Button
            className={cn(
              "border border-white/5 px-3 text-xs rounded-none",
              ddMode === "percent"
                ? "bg-sidebar-accent hover:bg-sidebar-accent hover:brightness-120 text-white"
                : "bg-sidebar text-white/25 hover:text-white hover:bg-sidebar-accent"
            )}
            onClick={() => onDdModeChange?.("percent")}
          >
            %
          </Button>

          <Button
            className={cn(
              "border border-white/5 border-l-0 px-3 text-xs rounded-none",
              ddMode === "usd"
                ? "bg-sidebar-accent hover:bg-sidebar-accent hover:brightness-120 text-white"
                : "bg-sidebar text-white/25 hover:text-white hover:bg-sidebar-accent"
            )}
            onClick={() => onDdModeChange?.("usd")}
          >
            $
          </Button>
        </div>

        {/* Dukascopy debug toggle */}
        <Button
          className={cn(
            "border border-white/5 mx-1 px-3 text-xs rounded-none",
            dukaDebug
              ? "bg-yellow-600/25 text-yellow-300 hover:bg-yellow-600/35"
              : "bg-sidebar text-white/25 hover:text-white hover:bg-sidebar-accent"
          )}
          onClick={() => onDukaDebugChange?.(!dukaDebug)}
          title="Toggle Dukascopy debug logs"
        >
          Debug
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="border border-white/5 bg-transparent hover:bg-sidebar-accent px-4 py-4 h-max text-xs text-white/70 rounded-none group">
              <Funnel className="size-3.5 text-white/60 group-hover:text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-none bg-sidebar border border-white/5 w-[240px] p-1"
          >
            {table
              .getAllLeafColumns()
              .filter((col) => col.getCanHide())
              .map((col) => {
                const label =
                  typeof col.columnDef.header === "string"
                    ? (col.columnDef.header as string)
                    : col.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={async (checked) => {
                      col.toggleVisibility(!!checked);
                      const mapping: Record<string, boolean> = {};
                      console.log("mapping", mapping);
                      table.getAllLeafColumns().forEach((c) => {
                        if (!c.getCanHide()) return;
                        mapping[c.id] =
                          c.id === col.id ? !!checked : c.getIsVisible();
                      });
                      await trpcClient.users.updateTablePreferences.mutate({
                        tableId: tableId || "trades",
                        preferences: { columnVisibility: mapping },
                      });
                    }}
                    className="p-3 text-xs"
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* No explicit Save button; preferences update immediately on toggle */}
    </div>
  );
}
