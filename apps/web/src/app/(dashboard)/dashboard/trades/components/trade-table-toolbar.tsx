"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedCallback } from "use-debounce";
import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  APP_TOOLTIP_SURFACE_CLASS,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useDateRangeStore } from "@/stores/date-range";
import TradeMultiSelect from "@/components/trade-multi-select";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Funnel,
  Lightbulb,
  ListFilterPlus,
  Minus,
  Plus,
  Tag as TagIcon,
  XCircle,
} from "lucide-react";
import DateRangeFilter from "@/components/ui/date-range-filter";
import RangeSlider from "@/components/slider";
import type { Table } from "@tanstack/react-table";
import { trpcClient } from "@/utils/trpc";
import { ViewSwitcher } from "@/components/view-switcher";
import { QuickTradeEntry } from "@/components/trades/quick-trade-entry";
import {
  getTradeDirectionTone,
  getTradeIdentifierColorStyle,
  getTradeOutcomeTone,
  getTradeProtocolTone,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";

type OutcomeFilterValue = "Win" | "Loss" | "BE" | "PW" | "Live";

const ALL_OUTCOME_FILTER_VALUES: OutcomeFilterValue[] = [
  "Win",
  "Loss",
  "BE",
  "PW",
  "Live",
];

const OUTCOME_FILTER_LABELS: Record<OutcomeFilterValue, string> = {
  Win: "Win",
  Loss: "Loss",
  BE: "Break-even",
  PW: "Partial win",
  Live: "Live",
};

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
  killzones: string[];
  onKillzonesChange: (k: string[]) => void;
  allKillzones?: Array<{ name: string; color: string }>;
  sessionTags: string[];
  onSessionTagsChange: (s: string[]) => void;
  allSessionTags?: Array<{ name: string; color: string }>;
  modelTags: string[];
  onModelTagsChange: (m: string[]) => void;
  allModelTags?: Array<{ name: string; color: string }>;
  protocolAlignments: string[];
  onProtocolAlignmentsChange: (p: string[]) => void;
  outcomes: string[];
  onOutcomesChange: (o: string[]) => void;
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
  rrHistogram?: number[];
  mfeHistogram?: number[];
  maeHistogram?: number[];
  efficiencyHistogram?: number[];
  ddMode?: "pips" | "percent" | "usd";
  onDdModeChange?: (m: "pips" | "percent" | "usd") => void;
  dukaDebug?: boolean;
  onDukaDebugChange?: (enabled: boolean) => void;
  selectedViewId?: string | null;
  onViewChange?: (viewId: string | null) => void;
  onManageViews?: () => void;
  accountId?: string | null;
  statFilters?: {
    rrMin?: number;
    rrMax?: number;
    mfeMin?: number;
    mfeMax?: number;
    maeMin?: number;
    maeMax?: number;
    efficiencyMin?: number;
    efficiencyMax?: number;
  };
  onStatFiltersChange?: (filters: {
    rrMin?: number;
    rrMax?: number;
    mfeMin?: number;
    mfeMax?: number;
    maeMin?: number;
    maeMax?: number;
    efficiencyMin?: number;
    efficiencyMax?: number;
  }) => void;
  onStatFiltersApply?: (filters?: {
    rrMin?: number;
    rrMax?: number;
    mfeMin?: number;
    mfeMax?: number;
    maeMin?: number;
    maeMax?: number;
    efficiencyMin?: number;
    efficiencyMax?: number;
  }) => void;
  groupBy?: string | null;
  onGroupByChange?: (groupBy: string | null) => void;
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
  ddMode,
  onDdModeChange,
  dukaDebug,
  onDukaDebugChange,
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
  const [statFilters, setStatFilters] = React.useState<{
    rrMin?: number;
    rrMax?: number;
    mfeMin?: number;
    mfeMax?: number;
    maeMin?: number;
    maeMax?: number;
    efficiencyMin?: number;
    efficiencyMax?: number;
  }>(statFiltersProp || {});

  React.useEffect(() => {
    setStatFilters(statFiltersProp || {});
  }, [statFiltersProp]);

  React.useEffect(() => {
    onStatFiltersChange?.(statFilters);
  }, [statFilters]);

  const [symInput, setSymInput] = React.useState("");
  const debouncedQ = useDebouncedCallback(onQChange, 300);
  const { min, max } = useDateRangeStore();
  const persistTimeoutRef = React.useRef<number | null>(null);
  const pendingVisibilityRef = React.useRef<Record<string, boolean> | null>(
    null
  );
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

  const [stagedKillzones, setStagedKillzones] =
    React.useState<string[]>(killzones);
  React.useEffect(() => {
    setStagedKillzones(killzones);
  }, [killzones]);

  const [stagedSessionTags, setStagedSessionTags] =
    React.useState<string[]>(sessionTags);
  React.useEffect(() => {
    setStagedSessionTags(sessionTags);
  }, [sessionTags]);

  const [stagedModelTags, setStagedModelTags] =
    React.useState<string[]>(modelTags);
  React.useEffect(() => {
    setStagedModelTags(modelTags);
  }, [modelTags]);

  const [stagedProtocol, setStagedProtocol] =
    React.useState<string[]>(protocolAlignments);
  React.useEffect(() => {
    setStagedProtocol(protocolAlignments);
  }, [protocolAlignments]);

  const [stagedOutcomes, setStagedOutcomes] =
    React.useState<string[]>(outcomes);
  React.useEffect(() => {
    setStagedOutcomes(outcomes);
  }, [outcomes]);

  React.useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
      }
    };
  }, []);

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
      "profit:desc": "Highest profit and loss first",
      "profit:asc": "Lowest profit and loss first",
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
        ? "Profit and loss"
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

  const badgeBaseClass =
    "cursor-pointer flex items-center justify-center px-3 py-2 h-[38px] text-xs text-white/70 hover:text-white transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent";
  const filterMenuSurfaceClass = cn(
    APP_TOOLTIP_SURFACE_CLASS,
    "border-white/6 bg-sidebar/95 text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
  );
  const filterMenuContentClass = `${filterMenuSurfaceClass} w-[320px] p-1.5 -mr-[9px]`;
  const filterMenuSubContentClass = `${filterMenuSurfaceClass} ml-4 overflow-visible p-0`;
  const filterMenuSectionTitleClass =
    "px-4 py-2 text-[11px] font-semibold text-white/55";
  const filterMenuMainSeparatorClass = "-mx-1.5 w-[calc(100%+0.75rem)]";
  const filterMenuTriggerClass =
    "px-4 py-2.5 text-xs text-white/75 data-[highlighted]:bg-sidebar-accent/80 data-[state=open]:bg-sidebar-accent/80";
  const filterMenuLabelClass =
    "px-4 py-2 text-[11px] font-medium text-white/50";
  const filterMenuSubSeparatorClass = "w-full";
  const filterMenuOptionRowClass =
    "flex items-center gap-3 rounded-sm px-4 py-2 text-xs text-white/80 transition-colors hover:bg-sidebar-accent/70";
  const filterMenuCheckboxClass =
    "rounded-md border-white/10 bg-white/[0.02] cursor-pointer data-[state=checked]:border-white/15 data-[state=checked]:bg-white/[0.08] data-[state=checked]:text-white";
  const filterMenuActionButtonClass =
    "flex-1 rounded-sm border border-white/8 bg-white/[0.03] py-2.5 text-xs text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.06]";
  const filterMenuScrollableBodyClass = "max-h-64 overflow-auto py-2";
  const filterMenuFooterClass = "flex gap-2 px-3 py-3";
  const selectMenuContentClass = `${filterMenuSurfaceClass} px-1.5 pb-2 pt-0.5`;
  const selectMenuSubContentClass = `${filterMenuSurfaceClass} ml-4 p-1`;
  const selectMenuItemClass =
    "px-4 py-2.5 text-xs text-white/75 data-[highlighted]:bg-sidebar-accent/80";
  const numericFilterSpikes = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => (i + 1) / 25),
    []
  );
  const getHistogramBounds = React.useCallback(
    (
      values: number[] | undefined,
      options: {
        minFloor?: number;
        maxFloor?: number;
        fallbackMin?: number;
        fallbackMax?: number;
      } = {}
    ) => {
      const { minFloor, maxFloor, fallbackMin = 0, fallbackMax = 1 } = options;
      const finiteValues = (values || []).filter((value) =>
        Number.isFinite(value)
      );
      let minValue = finiteValues.length
        ? Math.min(...finiteValues)
        : fallbackMin;
      let maxValue = finiteValues.length
        ? Math.max(...finiteValues)
        : fallbackMax;

      if (typeof minFloor === "number") {
        minValue = Math.min(minFloor, minValue);
      }
      if (typeof maxFloor === "number") {
        maxValue = Math.max(maxFloor, maxValue);
      }
      if (minValue === maxValue) {
        maxValue = minValue + 1;
      }

      return [minValue, maxValue] as const;
    },
    []
  );

  const renderDirectionPill = React.useCallback(
    (direction: "long" | "short") => (
      <span
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          "pointer-events-none gap-1 pr-2",
          getTradeDirectionTone(direction)
        )}
      >
        {direction === "long" ? "Long" : "Short"}
        {direction === "long" ? (
          <ArrowUpRight className="size-3 stroke-3" />
        ) : (
          <ArrowDownRight className="size-3 stroke-3" />
        )}
      </span>
    ),
    []
  );

  const renderTagPill = React.useCallback(
    (
      label: string,
      color?: string | null,
      icon?: React.ReactNode,
      fallbackTone: string = TRADE_IDENTIFIER_TONES.neutral
    ) => (
      <span
        style={color ? getTradeIdentifierColorStyle(color) : undefined}
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          "pointer-events-none max-w-[180px]",
          !color && fallbackTone
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </span>
    ),
    []
  );

  const renderProtocolPill = React.useCallback(
    (value: "aligned" | "against" | "discretionary") => {
      const icon =
        value === "aligned" ? (
          <CheckCircle2 className="size-3" />
        ) : value === "against" ? (
          <XCircle className="size-3" />
        ) : (
          <Minus className="size-3" />
        );
      const label =
        value === "aligned"
          ? "Aligned"
          : value === "against"
          ? "Against"
          : "Discretionary";

      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            "pointer-events-none",
            getTradeProtocolTone(value)
          )}
        >
          {icon}
          <span>{label}</span>
        </span>
      );
    },
    []
  );

  const renderOutcomePill = React.useCallback((value: OutcomeFilterValue) => {
    if (value === "Live") {
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            TRADE_IDENTIFIER_TONES.live,
            "pointer-events-none gap-2"
          )}
        >
          <span className="size-1.5 rounded-sm bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.35)]" />
          <span>Live</span>
        </span>
      );
    }

    return (
      <span
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          "pointer-events-none",
          getTradeOutcomeTone(value)
        )}
      >
        {OUTCOME_FILTER_LABELS[value]}
      </span>
    );
  }, []);

  const formatTriggerLabel = React.useCallback(
    (label: string, count?: number) =>
      count && count > 0 ? `${label} (${count})` : label,
    []
  );

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

  const hasDateRange = Boolean(start && end);
  const hasDirection = (tradeDirection ?? "all") !== "all";
  const hasHold = typeof holdMin === "number" && typeof holdMax === "number";
  const hasVolume =
    typeof volumeMin === "number" && typeof volumeMax === "number";
  const hasProfit =
    typeof profitMin === "number" && typeof profitMax === "number";
  const hasCommissions =
    typeof commissionsMin === "number" && typeof commissionsMax === "number";
  const hasSwap = typeof swapMin === "number" && typeof swapMax === "number";
  const hasKillzones =
    killzones.length > 0 && killzones.length !== (allKillzones?.length || 0);
  const hasSessionTags =
    sessionTags.length > 0 &&
    sessionTags.length !== (allSessionTags?.length || 0);
  const hasModelTags =
    modelTags.length > 0 && modelTags.length !== (allModelTags?.length || 0);
  const hasProtocol =
    protocolAlignments.length > 0 && protocolAlignments.length !== 3;
  const hasOutcomes =
    outcomes.length > 0 && outcomes.length !== ALL_OUTCOME_FILTER_VALUES.length;
  const hasSymbols =
    symbols.length > 0 && symbols.length !== (allSymbols?.length || 0);
  const hasRrFilter =
    typeof statFilters.rrMin === "number" ||
    typeof statFilters.rrMax === "number";
  const hasMfeFilter =
    typeof statFilters.mfeMin === "number" ||
    typeof statFilters.mfeMax === "number";
  const hasMaeFilter =
    typeof statFilters.maeMin === "number" ||
    typeof statFilters.maeMax === "number";
  const hasEfficiencyFilter =
    typeof statFilters.efficiencyMin === "number" ||
    typeof statFilters.efficiencyMax === "number";

  const appliedFilters = [
    hasDateRange
      ? {
          key: "date",
          label: `Date: ${formatHuman(start!)} - ${formatHuman(end!)}`,
          onClear: () => onRangeChange?.(undefined, undefined),
        }
      : null,
    hasDirection
      ? {
          key: "direction",
          label: `Direction: ${
            tradeDirection === "long" ? "Longs only" : "Shorts only"
          }`,
          onClear: () => onDirectionChange("all"),
        }
      : null,
    hasHold
      ? {
          key: "hold",
          label: formatHoldBadge(holdMin, holdMax, holdHistogram),
          onClear: () => onHoldClear?.(),
        }
      : null,
    hasVolume
      ? {
          key: "volume",
          label: formatNumBadge(
            "Volume",
            volumeMin,
            volumeMax,
            volumeHistogram
          ),
          onClear: () => onVolumeClear?.(),
        }
      : null,
    hasProfit
      ? {
          key: "profit",
          label: formatNumBadge(
            "Profit and loss",
            profitMin,
            profitMax,
            profitHistogram,
            "$"
          ),
          onClear: () => onProfitClear?.(),
        }
      : null,
    hasCommissions
      ? {
          key: "commissions",
          label: formatNumBadge(
            "Commissions",
            commissionsMin,
            commissionsMax,
            commissionsHistogram,
            "$"
          ),
          onClear: () => onCommissionsClear?.(),
        }
      : null,
    hasSwap
      ? {
          key: "swap",
          label: formatNumBadge("Swap", swapMin, swapMax, swapHistogram, "$"),
          onClear: () => onSwapClear?.(),
        }
      : null,
    hasKillzones
      ? {
          key: "killzones",
          label: (() => {
            const shown = killzones.slice(0, 2).join(", ");
            const extra = killzones.length - 2;
            return extra > 0
              ? `Killzones: ${shown} +${extra}`
              : `Killzones: ${shown}`;
          })(),
          onClear: () => onKillzonesChange([]),
        }
      : null,
    hasSessionTags
      ? {
          key: "session-tags",
          label: (() => {
            const shown = sessionTags.slice(0, 2).join(", ");
            const extra = sessionTags.length - 2;
            return extra > 0
              ? `Session: ${shown} +${extra}`
              : `Session: ${shown}`;
          })(),
          onClear: () => onSessionTagsChange([]),
        }
      : null,
    hasModelTags
      ? {
          key: "model-tags",
          label: (() => {
            const shown = modelTags.slice(0, 2).join(", ");
            const extra = modelTags.length - 2;
            return extra > 0 ? `Model: ${shown} +${extra}` : `Model: ${shown}`;
          })(),
          onClear: () => onModelTagsChange([]),
        }
      : null,
    hasProtocol
      ? {
          key: "protocol",
          label: (() => {
            const labels: Record<string, string> = {
              aligned: "Aligned",
              against: "Against",
              discretionary: "Discretionary",
            };
            const shown = protocolAlignments
              .slice(0, 2)
              .map((p) => labels[p] || p)
              .join(", ");
            const extra = protocolAlignments.length - 2;
            return extra > 0
              ? `Protocol: ${shown} +${extra}`
              : `Protocol: ${shown}`;
          })(),
          onClear: () => onProtocolAlignmentsChange([]),
        }
      : null,
    hasOutcomes
      ? {
          key: "outcomes",
          label: (() => {
            const shown = outcomes
              .slice(0, 2)
              .map((o) => OUTCOME_FILTER_LABELS[o as OutcomeFilterValue] || o)
              .join(", ");
            const extra = outcomes.length - 2;
            return extra > 0
              ? `Outcome: ${shown} +${extra}`
              : `Outcome: ${shown}`;
          })(),
          onClear: () => onOutcomesChange([]),
        }
      : null,
    hasSymbols
      ? {
          key: "symbols",
          label: (() => {
            const shown = symbols.slice(0, 3).join(", ");
            const extra = symbols.length - 3;
            return extra > 0
              ? `Symbols: ${shown} +${extra}`
              : `Symbols: ${shown}`;
          })(),
          onClear: () => onSymbolsChange([]),
        }
      : null,
    hasRrFilter
      ? {
          key: "rr",
          label: formatNumBadge(
            "Realised RR",
            statFilters.rrMin,
            statFilters.rrMax
          ),
          onClear: () => {
            const next = {
              ...statFilters,
              rrMin: undefined,
              rrMax: undefined,
            };
            setStatFilters(next);
            onStatFiltersChange?.(next);
            onStatFiltersApply?.(next);
          },
        }
      : null,
    hasMfeFilter
      ? {
          key: "mfe",
          label: formatNumBadge("MFE", statFilters.mfeMin, statFilters.mfeMax),
          onClear: () => {
            const next = {
              ...statFilters,
              mfeMin: undefined,
              mfeMax: undefined,
            };
            setStatFilters(next);
            onStatFiltersChange?.(next);
            onStatFiltersApply?.(next);
          },
        }
      : null,
    hasMaeFilter
      ? {
          key: "mae",
          label: formatNumBadge("MAE", statFilters.maeMin, statFilters.maeMax),
          onClear: () => {
            const next = {
              ...statFilters,
              maeMin: undefined,
              maeMax: undefined,
            };
            setStatFilters(next);
            onStatFiltersChange?.(next);
            onStatFiltersApply?.(next);
          },
        }
      : null,
    hasEfficiencyFilter
      ? {
          key: "eff",
          label: (() => {
            const minVal = statFilters.efficiencyMin;
            const maxVal = statFilters.efficiencyMax;
            if (minVal == null && maxVal == null) return "";
            if (minVal == null) return `RR efficiency: ≤ ${maxVal}%`;
            if (maxVal == null) return `RR efficiency: ≥ ${minVal}%`;
            return `RR efficiency: ${minVal}% - ${maxVal}%`;
          })(),
          onClear: () => {
            const next = {
              ...statFilters,
              efficiencyMin: undefined,
              efficiencyMax: undefined,
            };
            setStatFilters(next);
            onStatFiltersChange?.(next);
            onStatFiltersApply?.(next);
          },
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    label: string;
    onClear: () => void;
  }[];

  const shouldGroupFilters = appliedFilters.length > 1;

  return (
    <div className="flex justify-between w-full items-center gap-2 py-2">
      <div className="flex items-center gap-2">
        {/* View Switcher */}
        {onViewChange && (
          <ViewSwitcher
            selectedViewId={selectedViewId}
            onViewChange={onViewChange}
            onManageViews={onManageViews}
            accountId={accountId || null}
          />
        )}

        <div className="flex w-128 items-center border border-white/5 pl-8 pr-2 h-[38px] group hover:bg-sidebar-accent transition duration-250 relative rounded-sm">
          <Input
            placeholder="Search (symbol)"
            defaultValue={q}
            onChange={(e) => debouncedQ(e.target.value)}
            className="h-full py-0 text-xs focus-visible:scale-100 px-0 border-none hover:none group-hover:bg-sidebar-accent hover:brightness-100"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="relative text-[11px] bg-transparent hover:bg-sidebar-accent hover:bg-transparent">
                <ListFilterPlus className="text-white/60 size-4 hover:text-white " />
                {appliedFilters.length > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-md border border-white/10 bg-white/[0.08] px-1 text-[10px] font-medium leading-none text-white/80">
                    {appliedFilters.length}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className={filterMenuContentClass}>
              <div className={filterMenuSectionTitleClass}>Filters</div>

              <Separator className={filterMenuMainSeparatorClass} />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  Date
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[320px] p-4")}
                >
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
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  Direction
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[220px] p-1")}
                >
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
                    {renderDirectionPill("long")}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => onDirectionChange("short")}
                    className="px-4 py-2.5"
                  >
                    {renderDirectionPill("short")}
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
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  {formatTriggerLabel("Symbol", stagedSymbols.length)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[280px]")}
                >
                  <DropdownMenuLabel className={filterMenuLabelClass}>
                    Select symbols
                  </DropdownMenuLabel>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuScrollableBodyClass}>
                    {(allSymbols || []).map((sym) => {
                      const selected = stagedSymbols.includes(sym);
                      return (
                        <label key={sym} className={filterMenuOptionRowClass}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedSymbols);
                              if (v) next.add(sym);
                              else next.delete(sym);
                              setStagedSymbols(Array.from(next));
                            }}
                            className={filterMenuCheckboxClass}
                          />
                          <span className="select-none tracking-wide text-white/75">
                            {sym}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuFooterClass}>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedSymbols([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className={filterMenuActionButtonClass}
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
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  Volume
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
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
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  Profit and loss
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
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
                        minInputLabel="Minimum profit and loss"
                        maxInputLabel="Maximum profit and loss"
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
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  Commissions
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
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
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  Swap
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  {formatTriggerLabel("Killzone", stagedKillzones.length)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[280px]")}
                >
                  <DropdownMenuLabel className={filterMenuLabelClass}>
                    Select killzones
                  </DropdownMenuLabel>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuScrollableBodyClass}>
                    {(allKillzones || []).map((kz) => {
                      const selected = stagedKillzones.includes(kz.name);
                      return (
                        <label
                          key={kz.name}
                          className={cn(
                            filterMenuOptionRowClass,
                            selected && "bg-sidebar-accent/40"
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedKillzones);
                              if (v) next.add(kz.name);
                              else next.delete(kz.name);
                              setStagedKillzones(Array.from(next));
                            }}
                            className={filterMenuCheckboxClass}
                          />
                          {renderTagPill(
                            kz.name,
                            kz.color,
                            <TagIcon className="size-3" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuFooterClass}>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedKillzones([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        onKillzonesChange(stagedKillzones);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  {formatTriggerLabel("Session tag", stagedSessionTags.length)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[280px]")}
                >
                  <DropdownMenuLabel className={filterMenuLabelClass}>
                    Select session tags
                  </DropdownMenuLabel>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuScrollableBodyClass}>
                    {(allSessionTags || []).map((tag) => {
                      const selected = stagedSessionTags.includes(tag.name);
                      return (
                        <label
                          key={tag.name}
                          className={cn(
                            filterMenuOptionRowClass,
                            selected && "bg-sidebar-accent/40"
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedSessionTags);
                              if (v) next.add(tag.name);
                              else next.delete(tag.name);
                              setStagedSessionTags(Array.from(next));
                            }}
                            className={filterMenuCheckboxClass}
                          />
                          {renderTagPill(
                            tag.name,
                            tag.color,
                            <TagIcon className="size-3" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuFooterClass}>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedSessionTags([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSessionTagsChange(stagedSessionTags);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  {formatTriggerLabel("Model tag", stagedModelTags.length)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[280px]")}
                >
                  <DropdownMenuLabel className={filterMenuLabelClass}>
                    Select model tags
                  </DropdownMenuLabel>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuScrollableBodyClass}>
                    {(allModelTags || []).map((tag) => {
                      const selected = stagedModelTags.includes(tag.name);
                      return (
                        <label
                          key={tag.name}
                          className={cn(
                            filterMenuOptionRowClass,
                            selected && "bg-sidebar-accent/40"
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedModelTags);
                              if (v) next.add(tag.name);
                              else next.delete(tag.name);
                              setStagedModelTags(Array.from(next));
                            }}
                            className={filterMenuCheckboxClass}
                          />
                          {renderTagPill(
                            tag.name,
                            tag.color,
                            <Lightbulb className="size-3" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuFooterClass}>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedModelTags([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        onModelTagsChange(stagedModelTags);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  {formatTriggerLabel(
                    "Protocol alignment",
                    stagedProtocol.length
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[280px]")}
                >
                  <DropdownMenuLabel className={filterMenuLabelClass}>
                    Select protocol alignment
                  </DropdownMenuLabel>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuScrollableBodyClass}>
                    {[
                      { value: "aligned" as const },
                      { value: "against" as const },
                      { value: "discretionary" as const },
                    ].map((option) => {
                      const selected = stagedProtocol.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={cn(
                            filterMenuOptionRowClass,
                            selected && "bg-sidebar-accent/40"
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedProtocol);
                              if (v) next.add(option.value);
                              else next.delete(option.value);
                              setStagedProtocol(Array.from(next));
                            }}
                            className={filterMenuCheckboxClass}
                          />
                          {renderProtocolPill(option.value)}
                        </label>
                      );
                    })}
                  </div>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuFooterClass}>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedProtocol([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        onProtocolAlignmentsChange(stagedProtocol);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  {formatTriggerLabel("Outcome", stagedOutcomes.length)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[280px]")}
                >
                  <DropdownMenuLabel className={filterMenuLabelClass}>
                    Select outcomes
                  </DropdownMenuLabel>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuScrollableBodyClass}>
                    {ALL_OUTCOME_FILTER_VALUES.map((option) => {
                      const selected = stagedOutcomes.includes(option);
                      return (
                        <label
                          key={option}
                          className={cn(
                            filterMenuOptionRowClass,
                            selected && "bg-sidebar-accent/40"
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedOutcomes);
                              if (v) next.add(option);
                              else next.delete(option);
                              setStagedOutcomes(Array.from(next));
                            }}
                            className={filterMenuCheckboxClass}
                          />
                          {renderOutcomePill(option)}
                        </label>
                      );
                    })}
                  </div>
                  <Separator className={filterMenuSubSeparatorClass} />
                  <div className={filterMenuFooterClass}>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedOutcomes([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOutcomesChange(stagedOutcomes);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <Separator className={filterMenuMainSeparatorClass} />
              <div className={filterMenuSectionTitleClass}>
                Statistical filters
              </div>
              <Separator className={filterMenuMainSeparatorClass} />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  R:R range
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
                  {(() => {
                    const [minH, maxH] = getHistogramBounds(rrHistogram, {
                      minFloor: 0,
                      maxFloor: 0,
                    });
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={minH}
                        max={maxH}
                        value={[
                          statFilters.rrMin ?? minH,
                          statFilters.rrMax ?? maxH,
                        ]}
                        histogramData={rrHistogram || []}
                        bins={180}
                        spikePositions={numericFilterSpikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum realised R:R"
                        maxInputLabel="Maximum realised R:R"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        disabled={!rrHistogram?.length}
                        onChange={([lo, hi]) =>
                          setStatFilters((prev) => ({
                            ...prev,
                            rrMin: lo,
                            rrMax: hi,
                          }))
                        }
                        onCountButtonClick={([lo, hi]) => {
                          const next = {
                            ...statFilters,
                            rrMin: lo,
                            rrMax: hi,
                          };
                          setStatFilters(next);
                          onStatFiltersApply?.(next);
                        }}
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  MFE range
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
                  {(() => {
                    const [minH, maxH] = getHistogramBounds(mfeHistogram, {
                      minFloor: 0,
                      maxFloor: 0,
                    });
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={minH}
                        max={maxH}
                        value={[
                          statFilters.mfeMin ?? minH,
                          statFilters.mfeMax ?? maxH,
                        ]}
                        histogramData={mfeHistogram || []}
                        bins={180}
                        spikePositions={numericFilterSpikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum MFE"
                        maxInputLabel="Maximum MFE"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        disabled={!mfeHistogram?.length}
                        onChange={([lo, hi]) =>
                          setStatFilters((prev) => ({
                            ...prev,
                            mfeMin: lo,
                            mfeMax: hi,
                          }))
                        }
                        onCountButtonClick={([lo, hi]) => {
                          const next = {
                            ...statFilters,
                            mfeMin: lo,
                            mfeMax: hi,
                          };
                          setStatFilters(next);
                          onStatFiltersApply?.(next);
                        }}
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  MAE range
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
                  {(() => {
                    const [minH, maxH] = getHistogramBounds(maeHistogram, {
                      minFloor: 0,
                      maxFloor: 0,
                    });
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={minH}
                        max={maxH}
                        value={[
                          statFilters.maeMin ?? minH,
                          statFilters.maeMax ?? maxH,
                        ]}
                        histogramData={maeHistogram || []}
                        bins={180}
                        spikePositions={numericFilterSpikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum MAE"
                        maxInputLabel="Maximum MAE"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        disabled={!maeHistogram?.length}
                        onChange={([lo, hi]) =>
                          setStatFilters((prev) => ({
                            ...prev,
                            maeMin: lo,
                            maeMax: hi,
                          }))
                        }
                        onCountButtonClick={([lo, hi]) => {
                          const next = {
                            ...statFilters,
                            maeMin: lo,
                            maeMax: hi,
                          };
                          setStatFilters(next);
                          onStatFiltersApply?.(next);
                        }}
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  Efficiency range
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(filterMenuSubContentClass, "w-[360px] p-2")}
                >
                  {(() => {
                    const [minH, maxH] = getHistogramBounds(
                      efficiencyHistogram,
                      {
                        minFloor: 0,
                        maxFloor: 100,
                        fallbackMin: 0,
                        fallbackMax: 100,
                      }
                    );
                    return (
                      <RangeSlider
                        label=""
                        mode="number"
                        min={minH}
                        max={maxH}
                        value={[
                          statFilters.efficiencyMin ?? minH,
                          statFilters.efficiencyMax ?? maxH,
                        ]}
                        prefix=""
                        suffix="%"
                        histogramData={efficiencyHistogram || []}
                        bins={180}
                        spikePositions={numericFilterSpikes}
                        baseBarPct={6}
                        spikeBarPct={72}
                        minInputLabel="Minimum efficiency"
                        maxInputLabel="Maximum efficiency"
                        showCountButton
                        countLabel={(count) => `Show ${count} trades`}
                        disabled={!efficiencyHistogram?.length}
                        onChange={([lo, hi]) =>
                          setStatFilters((prev) => ({
                            ...prev,
                            efficiencyMin: lo,
                            efficiencyMax: hi,
                          }))
                        }
                        onCountButtonClick={([lo, hi]) => {
                          const next = {
                            ...statFilters,
                            efficiencyMin: lo,
                            efficiencyMax: hi,
                          };
                          setStatFilters(next);
                          onStatFiltersApply?.(next);
                        }}
                      />
                    );
                  })()}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {shouldGroupFilters ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={cn(badgeBaseClass, "gap-2")}>
                Filters ({appliedFilters.length})
                <ChevronDown className="size-3.5 text-white/60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(selectMenuContentClass, "w-[320px]")}
            >
              {appliedFilters.map((filter) => (
                <DropdownMenuItem
                  key={filter.key}
                  className="p-0 focus:bg-transparent"
                  onSelect={filter.onClear}
                >
                  <span
                    className={cn(
                      badgeBaseClass,
                      "flex items-center w-full justify-between"
                    )}
                  >
                    {filter.label}
                    <span className="ml-2">×</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            {start && end ? (
              <Button
                className={badgeBaseClass}
                onClick={() => onRangeChange?.(undefined, undefined)}
              >
                Date: {formatHuman(start)} - {formatHuman(end)}{" "}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {(tradeDirection ?? "all") !== "all" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className={badgeBaseClass}>
                    {tradeDirection === "long" ? "Longs only" : "Shorts only"}
                    <span className="">
                      <ChevronDown className="size-4 text-white/50" />
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={cn(selectMenuContentClass, "w-[220px]")}
                >
                  <div className={filterMenuSectionTitleClass}>Direction</div>
                  <Separator className={filterMenuMainSeparatorClass} />
                  <DropdownMenuItem
                    className={selectMenuItemClass}
                    onSelect={() => onDirectionChange("all")}
                  >
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={selectMenuItemClass}
                    onSelect={() => onDirectionChange("long")}
                  >
                    Long
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={selectMenuItemClass}
                    onSelect={() => onDirectionChange("short")}
                  >
                    Short
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {typeof holdMin === "number" && typeof holdMax === "number" ? (
              <Button
                className={badgeBaseClass}
                onClick={() => onHoldClear?.()}
              >
                {formatHoldBadge(holdMin, holdMax, holdHistogram)}{" "}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {typeof volumeMin === "number" && typeof volumeMax === "number" ? (
              <Button
                className={badgeBaseClass}
                onClick={() => onVolumeClear?.()}
              >
                {formatNumBadge(
                  "Volume",
                  volumeMin,
                  volumeMax,
                  volumeHistogram
                )}{" "}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {typeof profitMin === "number" && typeof profitMax === "number" ? (
              <Button
                className={badgeBaseClass}
                onClick={() => onProfitClear?.()}
              >
                {formatNumBadge(
                  "Profit and loss",
                  profitMin,
                  profitMax,
                  profitHistogram,
                  "$"
                )}{" "}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {typeof commissionsMin === "number" &&
            typeof commissionsMax === "number" ? (
              <Button
                className={badgeBaseClass}
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
                className={badgeBaseClass}
                onClick={() => onSwapClear?.()}
              >
                {formatNumBadge("Swap", swapMin, swapMax, swapHistogram, "$")}{" "}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {/* Killzones badge */}
            {killzones.length > 0 &&
            killzones.length !== (allKillzones?.length || 0) ? (
              <Button
                className={cn(
                  badgeBaseClass,
                  "max-w-[260px] truncate flex items-center gap-2"
                )}
                onClick={() => onKillzonesChange([])}
              >
                {(() => {
                  const shown = killzones.slice(0, 2).join(", ");
                  const extra = killzones.length - 2;
                  return extra > 0 ? `${shown} +${extra}` : shown;
                })()}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {/* Session Tags badge */}
            {sessionTags.length > 0 &&
            sessionTags.length !== (allSessionTags?.length || 0) ? (
              <Button
                className={cn(
                  badgeBaseClass,
                  "max-w-[260px] truncate flex items-center gap-2"
                )}
                onClick={() => onSessionTagsChange([])}
              >
                {(() => {
                  const shown = sessionTags.slice(0, 2).join(", ");
                  const extra = sessionTags.length - 2;
                  return extra > 0
                    ? `Session: ${shown} +${extra}`
                    : `Session: ${shown}`;
                })()}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {/* Model Tags badge */}
            {modelTags.length > 0 &&
            modelTags.length !== (allModelTags?.length || 0) ? (
              <Button
                className={cn(
                  badgeBaseClass,
                  "max-w-[260px] truncate flex items-center gap-2"
                )}
                onClick={() => onModelTagsChange([])}
              >
                {(() => {
                  const shown = modelTags.slice(0, 2).join(", ");
                  const extra = modelTags.length - 2;
                  return extra > 0
                    ? `Model: ${shown} +${extra}`
                    : `Model: ${shown}`;
                })()}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {/* Protocol Alignment badge */}
            {protocolAlignments.length > 0 &&
            protocolAlignments.length !== 3 ? (
              <Button
                className={cn(
                  badgeBaseClass,
                  "max-w-[260px] truncate flex items-center gap-2"
                )}
                onClick={() => onProtocolAlignmentsChange([])}
              >
                {(() => {
                  const labels: Record<string, string> = {
                    aligned: "Aligned",
                    against: "Against",
                    discretionary: "Discretionary",
                  };
                  const shown = protocolAlignments
                    .slice(0, 2)
                    .map((p) => labels[p] || p)
                    .join(", ");
                  const extra = protocolAlignments.length - 2;
                  return extra > 0
                    ? `Protocol: ${shown} +${extra}`
                    : `Protocol: ${shown}`;
                })()}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {/* Outcome badge */}
            {outcomes.length > 0 &&
            outcomes.length !== ALL_OUTCOME_FILTER_VALUES.length ? (
              <Button
                className={cn(
                  badgeBaseClass,
                  "max-w-[260px] truncate flex items-center gap-2"
                )}
                onClick={() => onOutcomesChange([])}
              >
                {(() => {
                  const shown = outcomes
                    .slice(0, 2)
                    .map(
                      (o) => OUTCOME_FILTER_LABELS[o as OutcomeFilterValue] || o
                    )
                    .join(", ");
                  const extra = outcomes.length - 2;
                  return extra > 0
                    ? `Outcome: ${shown} +${extra}`
                    : `Outcome: ${shown}`;
                })()}
                <span className="ml-2">×</span>
              </Button>
            ) : null}

            {/* Symbols badge: show only when a subset (not all) is selected */}
            {symbols.length > 0 &&
            symbols.length !== (allSymbols?.length || 0) ? (
              <Popover
                open={symbolPopoverOpen}
                onOpenChange={setSymbolPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    className={cn(
                      badgeBaseClass,
                      "max-w-[260px] truncate flex items-center gap-1.5"
                    )}
                  >
                    {(() => {
                      const shown = symbols.slice(0, 3).join(", ");
                      const extra = symbols.length - 3;
                      return extra > 0 ? `${shown} +${extra}` : shown;
                    })()}
                    <span>
                      <ChevronDown className="size-4 text-white/50" />
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(filterMenuSurfaceClass, "w-[280px] p-0")}
                >
                  <div className={filterMenuLabelClass}>Select symbols</div>
                  <Separator className="w-full" />
                  <div className={filterMenuScrollableBodyClass}>
                    {(allSymbols || []).map((sym) => {
                      const selected = stagedSymbols.includes(sym);
                      return (
                        <label key={sym} className={filterMenuOptionRowClass}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => {
                              const next = new Set(stagedSymbols);
                              if (v) next.add(sym);
                              else next.delete(sym);
                              setStagedSymbols(Array.from(next));
                            }}
                            className={filterMenuCheckboxClass}
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
                  <Separator className="w-full" />
                  <div className={filterMenuFooterClass}>
                    <Button
                      className={filterMenuActionButtonClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedSymbols([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className={filterMenuActionButtonClass}
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
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="cursor-pointer flex items-center justify-center gap-1 px-3 py-2 h-[38px] text-xs text-white/70 transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent">
              Sort by
              <ChevronDown className="size-3.5 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(selectMenuContentClass, "w-[280px]")}
          >
            <div className={filterMenuSectionTitleClass}>Sort by</div>
            <Separator className={filterMenuMainSeparatorClass} />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                Quick sorts
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(selectMenuSubContentClass, "w-[220px]")}
              >
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "open:desc" })
                    )
                  }
                >
                  Latest open
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "open:asc" })
                    )
                  }
                >
                  Earliest open
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "profit:desc" })
                    )
                  }
                >
                  Highest profit and loss
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "profit:asc" })
                    )
                  }
                >
                  Lowest profit and loss
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() =>
                    globalThis.dispatchEvent(
                      new CustomEvent("apply-sort", { detail: "volume:desc" })
                    )
                  }
                >
                  Highest volume
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={selectMenuItemClass}
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
                  className={selectMenuItemClass}
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
            <Separator className={filterMenuMainSeparatorClass} />
            {[
              { id: "open", label: "Open" },
              { id: "close", label: "Close" },
              { id: "holdSeconds", label: "Hold time" },
              { id: "symbol", label: "Symbol" },
              { id: "tradeDirection", label: "Direction" },
              { id: "volume", label: "Volume" },
              { id: "profit", label: "Profit and loss" },
              { id: "commissions", label: "Commissions" },
              { id: "swap", label: "Swap" },
            ].map((col) => (
              <DropdownMenuSub key={col.id}>
                <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                  {col.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className={cn(selectMenuSubContentClass, "w-[220px]")}
                >
                  <DropdownMenuItem
                    className={selectMenuItemClass}
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
                    className={selectMenuItemClass}
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
            <Separator className={filterMenuMainSeparatorClass} />
            <DropdownMenuItem
              className={selectMenuItemClass}
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
            className={badgeBaseClass}
            onClick={() =>
              globalThis.dispatchEvent(new CustomEvent("clear-sort"))
            }
          >
            {sortBadge} <span className="ml-2">×</span>
          </Button>
        ) : null}

        {/* Group By */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn(
                "cursor-pointer flex items-center justify-center gap-1 px-3 py-2 h-[38px] text-xs rounded-sm transition-all active:scale-95 duration-250 border border-white/5",
                groupBy
                  ? "bg-sidebar-accent text-white"
                  : "bg-sidebar hover:bg-sidebar-accent text-white/70"
              )}
            >
              {groupBy ? `Grouped: ${groupBy}` : "Group by"}
              <ChevronDown className="size-3.5 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(selectMenuContentClass, "w-[200px]")}
          >
            <div className={filterMenuSectionTitleClass}>Group by</div>
            <Separator className={filterMenuMainSeparatorClass} />
            {[
              { key: "symbol", label: "Symbol" },
              { key: "session", label: "Session" },
              { key: "day", label: "Day" },
              { key: "direction", label: "Direction" },
              { key: "outcome", label: "Outcome" },
            ].map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                className={cn(
                  selectMenuItemClass,
                  groupBy === opt.key && "bg-sidebar-accent"
                )}
                onSelect={() =>
                  onGroupByChange?.(groupBy === opt.key ? null : opt.key)
                }
              >
                {opt.label}
                {groupBy === opt.key && (
                  <span className="ml-auto text-teal-400">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            {groupBy && (
              <>
                <Separator className={filterMenuMainSeparatorClass} />
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() => onGroupByChange?.(null)}
                >
                  Clear grouping
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1">
        {/* Pips / % / $ toggle */}
        <div className="flex items-center gap-1 bg-muted/25 rounded-sm p-[3px]">
          <Button
            className={cn(
              "cursor-pointer flex items-center justify-center rounded-sm px-3 py-2 h-max text-xs transition-all active:scale-95 duration-250",
              ddMode === "pips"
                ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120"
                : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white"
            )}
            onClick={() => onDdModeChange?.("pips")}
          >
            Pips
          </Button>

          <Button
            className={cn(
              "cursor-pointer flex items-center justify-center rounded-sm px-3 py-2 h-max text-xs transition-all active:scale-95 duration-250",
              ddMode === "percent"
                ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120"
                : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white"
            )}
            onClick={() => onDdModeChange?.("percent")}
          >
            %
          </Button>

          <Button
            className={cn(
              "cursor-pointer flex items-center justify-center rounded-sm px-3 py-2 h-max text-xs transition-all active:scale-95 duration-250",
              ddMode === "usd"
                ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120"
                : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white"
            )}
            onClick={() => onDdModeChange?.("usd")}
          >
            $
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="cursor-pointer flex items-center justify-center px-3 py-2 h-[38px] text-xs rounded-sm transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar hover:bg-sidebar-accent hover:brightness-110 group">
              <Funnel className="size-3.5 text-white/60 group-hover:text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(selectMenuContentClass, "w-[240px]")}
          >
            <div className={filterMenuSectionTitleClass}>Columns</div>
            <Separator className={filterMenuMainSeparatorClass} />
            {(() => {
              const coreColumns = [
                "symbol",
                "tradeDirection",
                "open",
                "close",
                "holdSeconds",
                "volume",
                "profit",
                "commissions",
                "swap",
              ];

              const columnLabels: Record<string, string> = {
                manipulationPips: "Manipulation pips",
                mfePips: "Maximum favorable excursion (pips)",
                maePips: "Maximum adverse excursion (pips)",
                mpeManipLegR:
                  "Maximum price excursion manipulation leg (risk units)",
                mpeManipPE_R:
                  "Maximum price excursion manipulation post exit (risk units)",
                maxRR: "Maximum reward to risk",
                realisedRR: "Realised reward to risk",
                rrCaptureEfficiency:
                  "Reward to risk capture efficiency (percent)",
                manipRREfficiency:
                  "Manipulation reward to risk efficiency (percent)",
                exitEfficiency: "Exit efficiency (percent)",
                rawSTDV: "Raw standard deviation",
                rawSTDV_PE: "Raw standard deviation post exit",
                stdvBucket: "Standard deviation (bucket)",
                estimatedWeightedMPE_R:
                  "Estimated weighted maximum price excursion (risk units)",
                plannedRR: "Planned reward to risk",
                plannedRiskPips: "Planned risk (pips)",
                plannedTargetPips: "Planned target (pips)",
                entrySpreadPips: "Entry spread (pips)",
                exitSpreadPips: "Exit spread (pips)",
                entrySlippagePips: "Entry slippage (pips)",
                exitSlippagePips: "Exit slippage (pips)",
                slModCount: "Stop loss modifications",
                tpModCount: "Take profit modifications",
                partialCloseCount: "Partial closes",
                exitDealCount: "Exit deals",
                exitVolume: "Exit volume",
                entryDealCount: "Entry deals",
                entryVolume: "Entry volume",
                scaleInCount: "Scale in",
                scaleOutCount: "Scale out",
                trailingStopDetected: "Trailing stop",
                entryPeakDurationSeconds: "Time to peak",
                postExitPeakDurationSeconds: "Time to post exit peak",
                entryBalance: "Entry balance",
                entryEquity: "Entry equity",
                entryMargin: "Entry margin",
                entryFreeMargin: "Entry free margin",
                entryMarginLevel: "Entry margin level",
                outcome: "Outcome",
                complianceStatus: "Compliance status",
              };
              const columnTooltips: Record<string, string> = {
                symbol: "The name of what you traded.",
                tradeDirection: "Shows if you bought or sold.",
                open: "When the trade started.",
                close: "When the trade ended.",
                holdSeconds: "How long the trade stayed open.",
                volume: "How big the trade was.",
                profit: "How much money you made or lost.",
                commissions: "Fees the broker took.",
                swap: "Overnight fee or credit.",
                killzone: "Old name for the session tag.",
                sessionTag: "Shows the time window name for this trade.",
                modelTag: "Shows the setup name you used.",
                protocolAlignment: "Shows if you followed your rules.",
                outcome: "Shows if you won, lost, broke even, or won part.",
                complianceStatus: "Shows if the trade passed your rules.",
                plannedRR: "The reward to risk you planned.",
                plannedRiskPips: "How far your stop was in pips.",
                plannedTargetPips: "How far your target was in pips.",
                manipulationPips: "How big the setup move was.",
                mfePips: "How far price went your way while you were in.",
                maePips: "How far price went against you while you were in.",
                mpeManipLegR:
                  "How big the best move was, using the setup move.",
                mpeManipPE_R:
                  "How big the after-exit move was, using the setup move.",
                maxRR: "The biggest reward to risk you could have had.",
                realisedRR: "The reward to risk you actually got.",
                rrCaptureEfficiency: "How much of the possible move you kept.",
                manipRREfficiency: "How much of the setup move you kept.",
                exitEfficiency: "How good your exit timing was.",
                rawSTDV: "How wild price was while you were in.",
                rawSTDV_PE: "How wild price was after you exited.",
                stdvBucket: "A simple label for how wild price was.",
                estimatedWeightedMPE_R:
                  "A realistic target based on your past trades.",
                entrySpreadPips: "How wide the spread was when you entered.",
                exitSpreadPips: "How wide the spread was when you exited.",
                entrySlippagePips: "How far price slipped when you entered.",
                exitSlippagePips: "How far price slipped when you exited.",
                slModCount: "How many times stop loss changed.",
                tpModCount: "How many times take profit changed.",
                partialCloseCount: "How many times you closed a part.",
                exitDealCount: "How many exit deals were used.",
                exitVolume: "Total size closed at exit.",
                entryDealCount: "How many entry deals were used.",
                entryVolume: "Total size opened at entry.",
                scaleInCount: "How many extra entries you added.",
                scaleOutCount: "How many extra exits you added.",
                trailingStopDetected:
                  "Shows if stop loss moved to follow price.",
                entryPeakDurationSeconds: "Time from entry to the best price.",
                postExitPeakDurationSeconds:
                  "Time from exit to the best price after.",
                entryBalance: "Balance when you entered.",
                entryEquity: "Equity when you entered.",
                entryMargin: "Margin used at entry.",
                entryFreeMargin: "Free margin at entry.",
                entryMarginLevel: "Margin level at entry.",
              };

              const groups: { label: string; ids: string[] }[] = [
                { label: "Core", ids: coreColumns },
                {
                  label: "Tags",
                  ids: [
                    "killzone",
                    "sessionTag",
                    "modelTag",
                    "protocolAlignment",
                    "outcome",
                  ],
                },
                {
                  label: "Compliance",
                  ids: ["complianceStatus"],
                },
                {
                  label: "Intent",
                  ids: ["plannedRR", "plannedRiskPips", "plannedTargetPips"],
                },
                {
                  label: "Opportunity",
                  ids: [
                    "manipulationPips",
                    "mfePips",
                    "maePips",
                    "mpeManipLegR",
                    "mpeManipPE_R",
                    "maxRR",
                    "rawSTDV",
                    "rawSTDV_PE",
                    "stdvBucket",
                    "estimatedWeightedMPE_R",
                  ],
                },
                {
                  label: "Execution",
                  ids: [
                    "realisedRR",
                    "rrCaptureEfficiency",
                    "manipRREfficiency",
                    "exitEfficiency",
                  ],
                },
                {
                  label: "Expert advisor execution",
                  ids: [
                    "entrySpreadPips",
                    "exitSpreadPips",
                    "entrySlippagePips",
                    "exitSlippagePips",
                    "slModCount",
                    "tpModCount",
                    "partialCloseCount",
                    "exitDealCount",
                    "exitVolume",
                    "entryDealCount",
                    "entryVolume",
                    "scaleInCount",
                    "scaleOutCount",
                    "trailingStopDetected",
                    "entryPeakDurationSeconds",
                    "postExitPeakDurationSeconds",
                    "entryBalance",
                    "entryEquity",
                    "entryMargin",
                    "entryFreeMargin",
                    "entryMarginLevel",
                  ],
                },
              ];

              const columnsById = new Map(
                table.getAllLeafColumns().map((col) => [col.id, col])
              );

              const formatLabel = (raw: string) => {
                const parts = raw.split(" ");
                return parts
                  .map((word, index) => {
                    if (index === 0) return word;
                    if (/^[A-Z0-9/:%().]+$/.test(word)) return word;
                    return word.toLowerCase();
                  })
                  .join(" ");
              };

              const schedulePersist = (mapping: Record<string, boolean>) => {
                pendingVisibilityRef.current = mapping;
                if (persistTimeoutRef.current) {
                  window.clearTimeout(persistTimeoutRef.current);
                }
                persistTimeoutRef.current = window.setTimeout(async () => {
                  const next = pendingVisibilityRef.current;
                  if (!next) return;
                  await trpcClient.users.updateTablePreferences.mutate({
                    tableId: tableId || "trades",
                    preferences: { columnVisibility: next },
                  });
                }, 400);
              };

              const handleToggle = (col: any, checked: boolean) => {
                col.toggleVisibility(!!checked);
                const mapping: Record<string, boolean> = {};
                table.getAllLeafColumns().forEach((c) => {
                  if (!c.getCanHide()) return;
                  mapping[c.id] =
                    c.id === col.id ? !!checked : c.getIsVisible();
                });
                schedulePersist(mapping);
              };

              const visibleGroups = groups.filter((group) =>
                group.ids.some((id) => {
                  const col = columnsById.get(id);
                  return col && col.getCanHide();
                })
              );

              return visibleGroups.map((group) => (
                <DropdownMenuSub key={group.label}>
                  <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                    {group.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className={cn(selectMenuSubContentClass, "w-[240px]")}
                  >
                    {group.ids
                      .flatMap((id) => {
                        const col = columnsById.get(id);
                        return col && col.getCanHide() ? [col] : [];
                      })
                      .map((col) => {
                        const rawLabel =
                          columnLabels[col.id] ||
                          (typeof col.columnDef.header === "string"
                            ? (col.columnDef.header as string)
                            : col.id);
                        const label = formatLabel(rawLabel);
                        const tooltip =
                          columnTooltips[col.id] || "Column details";
                        return (
                          <Tooltip key={col.id}>
                            <TooltipTrigger asChild>
                              <DropdownMenuCheckboxItem
                                checked={col.getIsVisible()}
                                onCheckedChange={(checked) =>
                                  handleToggle(col, !!checked)
                                }
                                onSelect={(e) => e.preventDefault()}
                                className="rounded-sm py-2.5 pr-4 pl-8 text-xs text-white/80 data-[highlighted]:bg-sidebar-accent/80"
                              >
                                {label}
                              </DropdownMenuCheckboxItem>
                            </TooltipTrigger>

                            <TooltipContent
                              side="left"
                              align="center"
                              className="mr-4 max-w-xs"
                            >
                              {tooltip}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ));
            })()}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* No explicit Save button; preferences update immediately on toggle */}
    </div>
  );
}
