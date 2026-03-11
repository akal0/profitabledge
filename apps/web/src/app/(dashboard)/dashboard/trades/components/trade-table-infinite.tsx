"use client";

import * as React from "react";
import { useInView } from "react-intersection-observer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { trpcOptions, queryClient } from "@/utils/trpc";
import { DataTable } from "@/components/data-table/index";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { useDataTable } from "@/hooks/use-data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccountStore } from "@/stores/account";
import TradesToolbar from "./trade-table-toolbar";
import { cn } from "@/lib/utils";
import { useQueryState, useQueryStates, parseAsString } from "nuqs";
import { ArrowDownRight, ArrowUpRight, Info, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KillzoneTagCell } from "@/components/killzone-tag-cell";
import { SessionTagCell } from "@/components/session-tag-cell";
import { ModelTagCell } from "@/components/model-tag-cell";
import { ProtocolAlignmentCell } from "@/components/protocol-alignment-cell";
import { ViewManagementDialog } from "@/components/view-management-dialog";
import { SampleGateBanner } from "@/components/sample-gate-banner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TradeActionsMenu } from "@/components/pnl-card/trade-actions-menu";
import { useDragSelect } from "@/hooks/use-drag-select";
import { DEFAULT_COLUMN_SIZES } from "@/hooks/use-column-resizing";
import { BulkActionsToolbar } from "@/components/dashboard/bulk-actions-toolbar";
import { TradeNotesEditor } from "@/components/trades/trade-notes-editor";
import { EmotionTagger } from "@/components/dashboard/emotion-tagger";
import { TradeComparisonSheet } from "@/components/trades/trade-comparison-sheet";
import { formatCurrencyValue, formatNumberValue } from "@/lib/trade-formatting";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
  getTradeDirectionTone,
  getTradeIdentifierColorStyle,
  getTradeProtocolTone,
} from "@/components/trades/trade-identifier-pill";

type TradeRow = {
  id: string;
  tp?: number | null;
  sl?: number | null;
  open: string;
  close: string;
  openText?: string | null;
  closeText?: string | null;
  symbol: string;
  tradeDirection: "long" | "short";
  volume: number;
  profit: number;
  commissions?: number | null;
  swap?: number | null;
  createdAtISO: string;
  holdSeconds: number;
  openPrice?: number | null;
  closePrice?: number | null;
  pips?: number | null;
  // Tagging (legacy + new)
  killzone?: string | null;
  killzoneColor?: string | null;
  sessionTag?: string | null;
  sessionTagColor?: string | null;
  modelTag?: string | null;
  modelTagColor?: string | null;
  protocolAlignment?: "aligned" | "against" | "discretionary" | null;
  outcome?: "Win" | "Loss" | "BE" | "PW";
  // Optional widgets that can be enabled via Columns menu
  maxRR?: number | null;
  drawdown?: number | null;
  // Intent metrics
  plannedRR?: number | null;
  plannedRiskPips?: number | null;
  plannedTargetPips?: number | null;
  // Opportunity metrics
  manipulationPips?: number | null;
  mfePips?: number | null;
  maePips?: number | null;
  entrySpreadPips?: number | null;
  exitSpreadPips?: number | null;
  entrySlippagePips?: number | null;
  exitSlippagePips?: number | null;
  slModCount?: number | null;
  tpModCount?: number | null;
  partialCloseCount?: number | null;
  exitDealCount?: number | null;
  exitVolume?: number | null;
  entryBalance?: number | null;
  entryEquity?: number | null;
  entryMargin?: number | null;
  entryFreeMargin?: number | null;
  entryMarginLevel?: number | null;
  entryDealCount?: number | null;
  entryVolume?: number | null;
  scaleInCount?: number | null;
  scaleOutCount?: number | null;
  trailingStopDetected?: boolean | null;
  entryPeakDurationSeconds?: number | null;
  postExitPeakDurationSeconds?: number | null;
  mpeManipLegR?: number | null;
  mpeManipPE_R?: number | null;
  rawSTDV?: number | null;
  rawSTDV_PE?: number | null;
  stdvBucket?: string | null;
  estimatedWeightedMPE_R?: number | null;
  // Execution metrics
  realisedRR?: number | null;
  // Efficiency metrics
  rrCaptureEfficiency?: number | null;
  manipRREfficiency?: number | null;
  exitEfficiency?: number | null;
  isLive?: boolean;
  complianceStatus?: "pass" | "fail" | "unknown";
  complianceFlags?: string[];
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

type DirectionType = "all" | "long" | "short";
type OutcomeFilterValue = "Win" | "Loss" | "BE" | "PW" | "Live";
type NumericRange = [number, number];
type ViewNumericFilter = { min?: number; max?: number };
type TradeViewFilters = {
  sessionTags?: string[];
  modelTags?: string[];
  protocolAlignment?: Array<"aligned" | "against" | "discretionary">;
  outcomes?: OutcomeFilterValue[];
  symbols?: string[];
  directions?: Array<"long" | "short">;
  tradeDirection?: DirectionType;
  dateRange?: { start?: string; end?: string };
  numericFilters?: Record<string, ViewNumericFilter>;
};
type AdvancedMetricsPreferences = {
  disableSampleGating?: boolean;
};
type SelectedTradeView = {
  id?: string;
  config?: unknown;
};
type SelectedTradeViewConfig = {
  filters?: TradeViewFilters;
  visibleColumns?: string[];
};
type NamedColorTag = {
  name: string;
  color: string;
};
type AccountOpenBounds = {
  minISO?: string | null;
  maxISO?: string | null;
};
type AccountStatsSummary = {
  initialBalance?: number | string | null;
};
type SampleGateStatusRow = {
  tier: string;
  required: number;
  current: number;
  isUnlocked: boolean;
  message: string;
};

const NO_RESULTS_FILTER_ID = "__trades_no_results__";

const parseDateParam = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const startOfUtcDay = (value: Date) => {
  const normalized = new Date(value);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

const endOfUtcDay = (value: Date) => {
  const normalized = new Date(value);
  normalized.setUTCHours(23, 59, 59, 999);
  return normalized;
};

const mergeArrayFilter = <T extends string>(manual: T[], fromView?: T[]) => {
  if (!manual.length && !(fromView?.length ?? 0)) {
    return { values: [] as T[], conflict: false };
  }
  if (!manual.length) {
    return { values: [...(fromView || [])], conflict: false };
  }
  if (!(fromView?.length ?? 0)) {
    return { values: [...manual], conflict: false };
  }

  const viewSet = new Set(fromView);
  const values = manual.filter((value) => viewSet.has(value));
  return { values, conflict: values.length === 0 };
};

const mergeDirectionFilter = (
  manual: DirectionType,
  fromView?: Array<"long" | "short">,
  legacyViewDirection?: DirectionType
) => {
  const viewDirections =
    fromView && fromView.length > 0
      ? fromView
      : legacyViewDirection && legacyViewDirection !== "all"
      ? [legacyViewDirection]
      : [];

  if (manual === "all" && !viewDirections.length) {
    return { value: "all" as DirectionType, conflict: false };
  }
  if (manual !== "all" && !viewDirections.length) {
    return { value: manual, conflict: false };
  }
  if (manual === "all" && viewDirections.length === 1) {
    return { value: viewDirections[0], conflict: false };
  }
  if (manual === "all") {
    return { value: "all" as DirectionType, conflict: false };
  }
  return {
    value: manual,
    conflict: viewDirections.length > 0 && !viewDirections.includes(manual),
  };
};

const mergeNumericRange = (
  manual?: NumericRange,
  fromView?: ViewNumericFilter
) => {
  const mergedMin = Math.max(
    manual?.[0] ?? Number.NEGATIVE_INFINITY,
    fromView?.min ?? Number.NEGATIVE_INFINITY
  );
  const mergedMax = Math.min(
    manual?.[1] ?? Number.POSITIVE_INFINITY,
    fromView?.max ?? Number.POSITIVE_INFINITY
  );

  if (!Number.isFinite(mergedMin) && !Number.isFinite(mergedMax)) {
    return { range: undefined, conflict: false };
  }
  if (mergedMin > mergedMax) {
    return { range: undefined, conflict: true };
  }

  const min = mergedMin === Number.NEGATIVE_INFINITY ? undefined : mergedMin;
  const max = mergedMax === Number.POSITIVE_INFINITY ? undefined : mergedMax;

  return {
    range:
      min == null && max == null
        ? undefined
        : ([
            min ?? Number.NEGATIVE_INFINITY,
            max ?? Number.POSITIVE_INFINITY,
          ] as NumericRange),
    conflict: false,
  };
};

const LEGACY_INTEGER_UPPER_BOUND_EPSILON = 0.999999;
const RANGE_QUERY_PRECISION = 4;

const sortRangeBounds = (lo: number, hi: number): NumericRange =>
  lo <= hi ? [lo, hi] : [hi, lo];

const parseRangeParam = (param: string): NumericRange | undefined => {
  if (!param) return undefined;

  // Prefer colon-delimited first so open-ended ranges like "5:" or ":10" work.
  if (param.includes(":")) {
    const [loRaw = "", hiRaw = ""] = param.split(":", 2);
    const hasLo = loRaw.trim().length > 0;
    const hasHi = hiRaw.trim().length > 0;
    if (!hasLo && !hasHi) return undefined;

    const lo = hasLo ? Number(loRaw) : Number.NEGATIVE_INFINITY;
    const hi = hasHi ? Number(hiRaw) : Number.POSITIVE_INFINITY;
    if ((hasLo && !Number.isFinite(lo)) || (hasHi && !Number.isFinite(hi))) {
      return undefined;
    }
    return sortRangeBounds(lo, hi);
  }

  // Signed hyphen-delimited, e.g. "-100--50" or "10.5-200.25"
  const match = param.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;

  const lo = Number(match[1]);
  const hi = Number(match[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  return sortRangeBounds(lo, hi);
};

const normalizeLegacyIntegerUpperBoundRange = (
  param: string,
  range?: NumericRange
): NumericRange | undefined => {
  if (!param || !range) return range;
  if (!/^(-?\d+)-(-?\d+)$/.test(param)) return range;

  const [min, max] = range;
  if (!Number.isFinite(max)) return range;
  return [min, max + LEGACY_INTEGER_UPPER_BOUND_EPSILON];
};

const formatRangeQueryValue = (
  value: number,
  precision = RANGE_QUERY_PRECISION
) => {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(precision));
  if (!Number.isFinite(rounded)) return "";
  if (Object.is(rounded, -0)) return "0";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
};

const serializeIntegerRange = (lo: number, hi: number) => {
  const [min, max] = sortRangeBounds(lo, hi);
  return `${Math.floor(min)}-${Math.ceil(max)}`;
};

const serializeDecimalRange = (
  lo: number,
  hi: number,
  precision = RANGE_QUERY_PRECISION
) => {
  const [min, max] = sortRangeBounds(lo, hi);
  return `${formatRangeQueryValue(min, precision)}-${formatRangeQueryValue(
    max,
    precision
  )}`;
};

const mergeDateRange = (
  manualStart?: Date,
  manualEnd?: Date,
  fromView?: { start?: string; end?: string }
) => {
  const viewStart = parseDateParam(fromView?.start);
  const viewEnd = parseDateParam(fromView?.end);

  const mergedStart = new Date(
    Math.max(
      manualStart
        ? startOfUtcDay(manualStart).getTime()
        : Number.NEGATIVE_INFINITY,
      viewStart ? startOfUtcDay(viewStart).getTime() : Number.NEGATIVE_INFINITY
    )
  );
  const mergedEnd = new Date(
    Math.min(
      manualEnd ? endOfUtcDay(manualEnd).getTime() : Number.POSITIVE_INFINITY,
      viewEnd ? endOfUtcDay(viewEnd).getTime() : Number.POSITIVE_INFINITY
    )
  );

  const hasStart =
    (manualStart ? 1 : 0) + (viewStart ? 1 : 0) > 0 &&
    Number.isFinite(mergedStart.getTime());
  const hasEnd =
    (manualEnd ? 1 : 0) + (viewEnd ? 1 : 0) > 0 &&
    Number.isFinite(mergedEnd.getTime());

  if (hasStart && hasEnd && mergedStart.getTime() > mergedEnd.getTime()) {
    return { start: undefined, end: undefined, conflict: true };
  }

  return {
    start: hasStart ? mergedStart : undefined,
    end: hasEnd ? mergedEnd : undefined,
    conflict: false,
  };
};

const isTradeWithinDateRange = (row: TradeRow, start?: Date, end?: Date) => {
  if (!start && !end) return true;
  const startMs = start
    ? startOfUtcDay(start).getTime()
    : Number.NEGATIVE_INFINITY;
  const endMs = end ? endOfUtcDay(end).getTime() : Number.POSITIVE_INFINITY;
  const openMs = Date.parse(row.open);
  const closeMs = Date.parse(row.close);

  const openInRange =
    Number.isFinite(openMs) && openMs >= startMs && openMs <= endMs;
  const closeInRange =
    Number.isFinite(closeMs) && closeMs >= startMs && closeMs <= endMs;

  return openInRange || closeInRange;
};

const isValueInRange = (
  value: number | null | undefined,
  range?: NumericRange
) => {
  if (!range) return true;
  if (value == null || Number.isNaN(Number(value))) return false;

  const [min, max] = range;
  if (Number.isFinite(min) && Number(value) < min) return false;
  if (Number.isFinite(max) && Number(value) > max) return false;
  return true;
};

const HEADER_TOOLTIPS: Record<string, string> = {
  symbol: "The name of what you traded.",
  tradeDirection: "Shows if you bought or sold.",
  sessionTag: "Shows the time window name for this trade.",
  modelTag: "Shows the setup name you used.",
  protocolAlignment: "Shows if you followed your rules.",
  outcome: "Shows if a trade is live, won, lost, broke even, or won part.",
  tp: "The price you wanted to take profit.",
  sl: "The price you wanted to stop loss.",
  open: "When the trade started.",
  close: "When the trade ended.",
  holdSeconds: "How long the trade stayed open.",
  volume: "How big the trade was.",
  profit: "How much money you made or lost.",
  commissions: "Fees the broker took.",
  swap: "Overnight fee or credit.",
  manipulationPips: "How big the setup move was.",
  mfePips: "How far price went your way while you were in.",
  maePips: "How far price went against you while you were in.",
  entrySpreadPips: "How wide the spread was when you entered.",
  exitSpreadPips: "How wide the spread was when you exited.",
  entrySlippagePips: "How far price slipped when you entered.",
  exitSlippagePips: "How far price slipped when you exited.",
  slModCount: "How many times stop loss changed.",
  tpModCount: "How many times take profit changed.",
  partialCloseCount: "How many times you closed a part.",
  exitDealCount: "How many exit deals were used.",
  exitVolume: "Total size closed at exit.",
  entryBalance: "Balance when you entered.",
  entryEquity: "Equity when you entered.",
  entryMargin: "Margin used at entry.",
  entryFreeMargin: "Free margin at entry.",
  entryMarginLevel: "Margin level at entry.",
  entryDealCount: "How many entry deals were used.",
  entryVolume: "Total size opened at entry.",
  scaleInCount: "How many extra entries you added.",
  scaleOutCount: "How many extra exits you added.",
  trailingStopDetected: "Shows if stop loss moved to follow price.",
  entryPeakDurationSeconds: "Time from entry to the best price.",
  postExitPeakDurationSeconds: "Time from exit to the best price after.",
  mpeManipLegR: "How big the best move was, using the setup move.",
  mpeManipPE_R: "How big the after-exit move was, using the setup move.",
  maxRR: "The biggest reward to risk you could have had.",
  realisedRR: "The reward to risk you actually got.",
  rrCaptureEfficiency: "How much of the possible move you kept.",
  manipRREfficiency: "How much of the setup move you kept.",
  rawSTDV: "How wild price was while you were in.",
  rawSTDV_PE: "How wild price was after you exited.",
  stdvBucket:
    "Shows volatility level: Very Low (-2σ), Low (-1σ), Normal (0σ), High (+1σ), Very High (+2σ).",
  estimatedWeightedMPE_R: "A realistic target based on your past trades.",
  plannedRR: "The reward to risk you planned.",
  plannedRiskPips: "How far your stop was in pips.",
  plannedTargetPips: "How far your target was in pips.",
  exitEfficiency: "How good your exit timing was.",
  drawdown: "How far price went against you.",
  complianceStatus: "Shows if the trade passed your rules.",
};

// Extracted component for drawdown cell that needs to use hooks
function DrawdownCell({
  trade,
  rowIndex,
}: {
  trade: TradeRow;
  rowIndex: number;
}) {
  const debug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("duka") === "1";
  const opts = trpcOptions.trades.drawdownForTrade.queryOptions({
    id: trade.id,
    debug,
  });
  const q = useQuery({
    ...opts,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [reveal, setReveal] = React.useState(false);
  React.useEffect(() => {
    if (q.isSuccess) {
      const handle = setTimeout(() => setReveal(true), rowIndex * 250);
      return () => clearTimeout(handle);
    } else {
      setReveal(false);
    }
  }, [q.isSuccess, rowIndex]);
  if (q.isLoading)
    return (
      <Skeleton className="h-5 w-[120px] bg-sidebar-accent rounded-none" />
    );
  if (!reveal)
    return (
      <Skeleton className="h-5 w-[120px] bg-sidebar-accent rounded-none" />
    );
  const d = q.data as
    | {
        id: string;
        adversePips: number | null;
        pctToSL?: number | null;
        pctToStoploss?: number | null;
        hit: "Stop loss" | "CLOSE" | "NONE" | "BE";
      }
    | null
    | undefined;
  if (!d) return <span className="text-white/40">—</span>;
  if ((d as any).note === "NO_Stop loss") {
    return (
      <span
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          TRADE_IDENTIFIER_TONES.subdued
        )}
      >
        No Stop loss
      </span>
    );
  }
  if (d.hit === "BE") {
    return (
      <span
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          TRADE_IDENTIFIER_TONES.neutral
        )}
      >
        Stop loss moved
      </span>
    );
  }
  if (d.adversePips == null) return <span className="text-white/40">—</span>;
  const pips = d.adversePips;
  const usd = (d as any).adverseUsd as number | undefined;
  const pct = d.pctToSL ?? d.pctToStoploss ?? null;
  let ddParam = "percent";
  if (typeof window !== "undefined") {
    try {
      const sp = new URLSearchParams(window.location.search);
      ddParam = sp.get("dd") || "percent";
    } catch {}
  }
  const isPercentMode = ddParam === "percent";
  const isUsdMode = ddParam === "usd";
  const formatCompact = (n: number) => {
    const rounded = Math.round(n * 100) / 100;
    return Number.isInteger(rounded)
      ? String(Math.trunc(rounded))
      : String(rounded);
  };
  let label: string;
  if (isPercentMode) {
    if (pct == null) {
      return <span className="text-white/40">—</span>;
    }
    label = `${Math.round(pct)}%`;
  } else if (isUsdMode)
    label =
      usd != null
        ? formatCurrencyValue(Number(usd), { maximumFractionDigits: 2 })
        : "$0";
  else label = `${formatCompact(pips)} pips`;
  // Determine chip style based on percent-to-Stop loss bucket
  const pctValue = Math.max(0, Math.min(100, Number(pct ?? 0)));
  let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
  if (pctValue === 0) {
    chipClass = TRADE_IDENTIFIER_TONES.neutral;
  } else if (pctValue < 25) {
    chipClass = TRADE_IDENTIFIER_TONES.positive;
  } else if (pctValue < 50) {
    chipClass = TRADE_IDENTIFIER_TONES.warning;
  } else if (pctValue < 75) {
    chipClass = TRADE_IDENTIFIER_TONES.warning;
  } else if (pctValue < 99) {
    chipClass = TRADE_IDENTIFIER_TONES.amber;
  } else {
    chipClass = TRADE_IDENTIFIER_TONES.negative;
  }
  return (
    <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, chipClass)}>{label}</span>
  );
}

const formatNumber = (value: number, decimals = 2) =>
  formatNumberValue(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const formatCount = (value: number) =>
  formatNumberValue(value, { maximumFractionDigits: 0 });
const formatPercent = (value: number, decimals = 0) =>
  `${formatNumber(value, decimals)}%`;
const formatPips = (value: number, decimals = 1) =>
  `${formatNumber(value, decimals)} pips`;
const formatCurrency = (value: number, decimals = 2) =>
  formatCurrencyValue(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const getProfitTone = (value: number) =>
  value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
    ? TRADE_IDENTIFIER_TONES.positive
    : TRADE_IDENTIFIER_TONES.neutral;

const getCommissionTone = (value: number) =>
  value < 0 ? TRADE_IDENTIFIER_TONES.negative : TRADE_IDENTIFIER_TONES.neutral;

const getSwapTone = (value: number) =>
  value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
    ? TRADE_IDENTIFIER_TONES.positive
    : TRADE_IDENTIFIER_TONES.neutral;

const getMaxRRTone = (value: number) =>
  value >= 2
    ? TRADE_IDENTIFIER_TONES.positive
    : value >= 1
    ? TRADE_IDENTIFIER_TONES.warning
    : TRADE_IDENTIFIER_TONES.neutral;

const getRealisedRRTone = (value: number) =>
  value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
    ? TRADE_IDENTIFIER_TONES.positive
    : TRADE_IDENTIFIER_TONES.neutral;

const getEfficiencyTone = (
  value: number,
  strongThreshold: number,
  mediumThreshold: number,
  softThreshold: number
) =>
  value >= strongThreshold
    ? TRADE_IDENTIFIER_TONES.positive
    : value >= mediumThreshold
    ? TRADE_IDENTIFIER_TONES.warning
    : value >= softThreshold
    ? TRADE_IDENTIFIER_TONES.amber
    : TRADE_IDENTIFIER_TONES.negative;

const getExitEfficiencyTone = (value: number) =>
  value >= 80
    ? TRADE_IDENTIFIER_TONES.positive
    : value >= 50
    ? TRADE_IDENTIFIER_TONES.warning
    : TRADE_IDENTIFIER_TONES.amber;

const getComplianceTone = (status: string | null | undefined) =>
  status === "pass"
    ? TRADE_IDENTIFIER_TONES.positive
    : status === "fail"
    ? TRADE_IDENTIFIER_TONES.negative
    : TRADE_IDENTIFIER_TONES.neutral;

// Helper to get current dd mode from URL
const getDdMode = (): "pips" | "percent" | "usd" => {
  if (typeof window === "undefined") return "pips";
  try {
    const sp = new URLSearchParams(window.location.search);
    const mode = sp.get("dd") || "pips";
    return mode as "pips" | "percent" | "usd";
  } catch {
    return "pips";
  }
};

// Format pip values based on current display mode
const formatPipValue = (pips: number, row?: TradeRow): string => {
  const mode = getDdMode();

  if (mode === "percent") {
    // For percent mode, calculate as percentage of entry balance
    if (row?.entryBalance && row.entryBalance > 0) {
      const pipValue = pips * (row.volume || 0) * 10; // Rough pip value calculation
      const percent = (pipValue / row.entryBalance) * 100;
      return `${formatNumber(percent, 2)}%`;
    }
    return `${formatNumber(pips, 1)}%`; // Fallback to pips as %
  } else if (mode === "usd") {
    // For USD mode, estimate dollar value (rough calculation)
    const pipValue = pips * (row?.volume || 0) * 10; // Standard lot pip value
    return formatCurrencyValue(pipValue, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else {
    // Default pips mode
    return `${formatNumber(pips, 1)} pips`;
  }
};
const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  }).format(value);
const formatDuration = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const withHeaderTooltip = (
  key: string,
  label: React.ReactNode
): React.ReactNode => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center gap-1 cursor-help">
        {label}
      </span>
    </TooltipTrigger>
    <TooltipContent className="mb-0">
      {HEADER_TOOLTIPS[key] || "Column details"}
    </TooltipContent>
  </Tooltip>
);

const columns: ColumnDef<TradeRow, any>[] = [
  // Selection column
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllRowsSelected() ||
          (table.getIsSomeRowsSelected() && "indeterminate")
        }
        onCheckedChange={(val) => table.toggleAllRowsSelected(!!val)}
        aria-label="Select all"
        className="translate-y-[2px] rounded-none border-white/5 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(val) => row.toggleSelected(!!val)}
        aria-label="Select row"
        className="translate-y-[2px] rounded-none border-white/5 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 32,
    minSize: 32,
    maxSize: 56,
  },
  {
    accessorKey: "symbol",
    header: () => withHeaderTooltip("symbol", "Symbol"),
  },
  {
    accessorKey: "tradeDirection",
    header: () => withHeaderTooltip("tradeDirection", "Direction"),
    cell: ({ getValue }) => {
      const v = getValue<string>();
      const label = v === "long" ? "Long" : "Short";
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            "gap-1 pr-2",
            v === "long"
              ? TRADE_IDENTIFIER_TONES.positive
              : TRADE_IDENTIFIER_TONES.negative
          )}
        >
          {label}

          {v === "long" ? (
            <ArrowUpRight className="size-3 stroke-3" />
          ) : (
            <ArrowDownRight className="size-3 stroke-3" />
          )}
        </span>
      );
    },
  },
  {
    accessorKey: "sessionTag",
    header: () => withHeaderTooltip("sessionTag", "Session"),
    cell: ({ row }) => {
      const trade = row.original as TradeRow;
      return (
        <SessionTagCell
          tradeId={trade.id}
          sessionTag={trade.sessionTag}
          sessionTagColor={trade.sessionTagColor}
        />
      );
    },
  },
  {
    accessorKey: "modelTag",
    header: () => withHeaderTooltip("modelTag", "Model"),
    cell: ({ row }) => {
      const trade = row.original as TradeRow;
      return (
        <ModelTagCell
          tradeId={trade.id}
          modelTag={trade.modelTag}
          modelTagColor={trade.modelTagColor}
        />
      );
    },
  },
  {
    accessorKey: "protocolAlignment",
    header: () => withHeaderTooltip("protocolAlignment", "Protocol"),
    cell: ({ row }) => {
      const trade = row.original as TradeRow;
      return (
        <ProtocolAlignmentCell
          tradeId={trade.id}
          protocolAlignment={trade.protocolAlignment}
        />
      );
    },
  },
  {
    accessorKey: "outcome",
    header: () => withHeaderTooltip("outcome", "Outcome"),
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      if (trade.isLive) {
        return (
          <span
            className={cn(
              TRADE_IDENTIFIER_PILL_CLASS,
              TRADE_IDENTIFIER_TONES.live,
              "gap-2"
            )}
          >
            <span className="size-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.4)]" />
            Live
          </span>
        );
      }

      const v = getValue<"Win" | "Loss" | "BE" | "PW" | undefined>();
      if (!v) return <span className="text-white/40">—</span>;

      let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
      let label: string = v || "";

      if (v === "Win") {
        chipClass = TRADE_IDENTIFIER_TONES.positive;
      } else if (v === "Loss") {
        chipClass = TRADE_IDENTIFIER_TONES.negative;
      } else if (v === "BE") {
        chipClass = TRADE_IDENTIFIER_TONES.neutral;
        label = "Breakeven";
      } else if (v === "PW") {
        chipClass = TRADE_IDENTIFIER_TONES.warning;
        label = "Partial win";
      }

      return (
        <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, chipClass)}>
          {label}
        </span>
      );
    },
  },
  {
    accessorKey: "complianceStatus",
    header: () => withHeaderTooltip("complianceStatus", "Compliance"),
    cell: ({ row }) => {
      const trade = row.original as TradeRow;
      const status = trade.complianceStatus || "unknown";
      const flags = trade.complianceFlags || [];
      let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
      let label = "Unknown";
      if (status === "pass") {
        chipClass = TRADE_IDENTIFIER_TONES.positive;
        label = "Pass";
      } else if (status === "fail") {
        chipClass = TRADE_IDENTIFIER_TONES.negative;
        label = "Flagged";
      }
      const tooltipText =
        flags.length > 0 ? flags.join(", ") : "No compliance flags.";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                "cursor-help",
                chipClass
              )}
            >
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: "streak",
    header: () => withHeaderTooltip("streak", "Streak"),
    cell: ({ row, table }) => {
      const rows = table.getRowModel().rows;
      const idx = rows.findIndex((r) => r.id === row.id);
      if (idx === -1) return <span className="text-white/25">—</span>;

      const current = row.original as TradeRow;
      const isWin = current.outcome === "Win" || current.outcome === "PW";
      const isLoss = current.outcome === "Loss";
      if (!isWin && !isLoss) return <span className="text-white/25">—</span>;

      // Count streak backwards from this trade
      let streak = 1;
      for (let i = idx - 1; i >= 0; i--) {
        const prev = rows[i].original as TradeRow;
        const prevWin = prev.outcome === "Win" || prev.outcome === "PW";
        const prevLoss = prev.outcome === "Loss";
        if ((isWin && prevWin) || (isLoss && prevLoss)) {
          streak++;
        } else {
          break;
        }
      }

      if (streak < 2) return <span className="text-white/25">—</span>;

      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            "min-h-6 px-2 py-0.5 text-[10px] font-semibold",
            isWin
              ? streak >= 5
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : TRADE_IDENTIFIER_TONES.positive
              : streak >= 5
              ? "border-red-400/20 bg-red-400/10 text-red-300"
              : TRADE_IDENTIFIER_TONES.negative
          )}
        >
          {isWin ? "W" : "L"}
          {streak}
          {streak >= 5 && (isWin ? " 🔥" : " ⚠️")}
        </span>
      );
    },
  },
  {
    accessorKey: "tp",
    header: () => withHeaderTooltip("tp", "Take profit"),
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      const v = trade.tp;

      if (v != null) {
        return <span className="text-white/80">{formatPrice(v)}</span>;
      } else {
        return <span className="text-white/80">—</span>;
      }
    },
  },
  {
    accessorKey: "sl",
    header: () => withHeaderTooltip("sl", "Stop loss"),
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      const v = trade.sl;

      if (v != null) {
        return <span className="text-white/80">{formatPrice(v)}</span>;
      } else {
        return <span className="text-white/80">—</span>;
      }
    },
  },
  {
    accessorKey: "open",
    header: () => withHeaderTooltip("open", "Open"),
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      if (trade.openText) {
        return (
          <p className="text-white font-medium tracking-wide">
            {trade.openText}
          </p>
        );
      }
      const d = new Date(getValue<string>());
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
      const month = d.toLocaleString("en-GB", { month: "short" }); // e.g., Oct
      const year = d.getFullYear();
      const datePart = `${day}${suf} ${month}' ${year}`;
      const timePart = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return (
        <p className="text-white font-medium tracking-wide">
          <span className="text-white/50 font-normal"> {datePart} </span>
          {`- ${timePart}`}
        </p>
      );
    },
  },
  {
    accessorKey: "close",
    header: () => withHeaderTooltip("close", "Close"),
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      if (trade.closeText) {
        return (
          <p className="text-white font-medium tracking-wide">
            {trade.closeText}
          </p>
        );
      }
      const d = new Date(getValue<string>());
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
      const datePart = `${day}${suf} ${month}' ${year}`;
      const timePart = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return (
        <p className="text-white font-medium tracking-wide">
          <span className="text-white/50 font-normal"> {datePart} </span>
          {`- ${timePart}`}
        </p>
      );
    },
  },
  {
    accessorKey: "holdSeconds",
    header: () => withHeaderTooltip("holdSeconds", "Hold time"),
    cell: ({ getValue }) => {
      const totalSec = Number(getValue<number>() || 0);
      return <span className="text-white/80">{formatDuration(totalSec)}</span>;
    },
  },
  {
    accessorKey: "volume",
    header: () => withHeaderTooltip("volume", "Volume"),
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      return (
        <span className="text-white font-medium tracking-wide">
          {formatNumberValue(v, { maximumFractionDigits: 2 })}
        </span>
      );
    },
  },
  {
    accessorKey: "profit",
    header: () => withHeaderTooltip("profit", "Profit and loss"),
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      return (
        <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, getProfitTone(v))}>
          {formatCurrencyValue(v, { maximumFractionDigits: 2 })}
        </span>
      );
    },
  },
  {
    accessorKey: "commissions",
    header: () => withHeaderTooltip("commissions", "Commissions"),
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      return (
        <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, getCommissionTone(v))}>
          {formatCurrencyValue(v, { maximumFractionDigits: 2 })}
        </span>
      );
    },
  },
  {
    accessorKey: "swap",
    header: () => withHeaderTooltip("swap", "Swap"),
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      return (
        <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, getSwapTone(v))}>
          {formatCurrencyValue(v, { maximumFractionDigits: 2 })}
        </span>
      );
    },
  },
  // Advanced trading metrics columns (hidden by default, toggleable)
  {
    accessorKey: "manipulationPips",
    header: () =>
      withHeaderTooltip(
        "manipulationPips",
        <div className="flex items-center gap-1">
          Manipulation pips
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "mfePips",
    header: () =>
      withHeaderTooltip(
        "mfePips",
        <div className="flex items-center gap-1">
          Maximum favorable excursion (pips)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "maePips",
    header: () =>
      withHeaderTooltip(
        "maePips",
        <div className="flex items-center gap-1">
          Maximum adverse excursion (pips)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "entrySpreadPips",
    header: () =>
      withHeaderTooltip(
        "entrySpreadPips",
        <div className="flex items-center gap-1">
          Entry spread (pips)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "exitSpreadPips",
    header: () =>
      withHeaderTooltip(
        "exitSpreadPips",
        <div className="flex items-center gap-1">
          Exit spread (pips)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "entrySlippagePips",
    header: () =>
      withHeaderTooltip(
        "entrySlippagePips",
        <div className="flex items-center gap-1">
          Entry slippage (pips)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "exitSlippagePips",
    header: () =>
      withHeaderTooltip(
        "exitSlippagePips",
        <div className="flex items-center gap-1">
          Exit slippage (pips)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "slModCount",
    header: () =>
      withHeaderTooltip(
        "slModCount",
        <div className="flex items-center gap-1">
          Stop loss modifications
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCount(v)}</span>;
    },
  },
  {
    accessorKey: "tpModCount",
    header: () =>
      withHeaderTooltip(
        "tpModCount",
        <div className="flex items-center gap-1">
          Take profit modifications
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCount(v)}</span>;
    },
  },
  {
    accessorKey: "partialCloseCount",
    header: () =>
      withHeaderTooltip(
        "partialCloseCount",
        <div className="flex items-center gap-1">
          Partial closes
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCount(v)}</span>;
    },
  },
  {
    accessorKey: "exitDealCount",
    header: () =>
      withHeaderTooltip(
        "exitDealCount",
        <div className="flex items-center gap-1">
          Exit deals
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCount(v)}</span>;
    },
  },
  {
    accessorKey: "exitVolume",
    header: () =>
      withHeaderTooltip(
        "exitVolume",
        <div className="flex items-center gap-1">
          Exit volume
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatNumber(v, 2)}</span>;
    },
  },
  {
    accessorKey: "entryBalance",
    header: () =>
      withHeaderTooltip(
        "entryBalance",
        <div className="flex items-center gap-1">
          Entry balance
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCurrency(v, 2)}</span>;
    },
  },
  {
    accessorKey: "entryEquity",
    header: () =>
      withHeaderTooltip(
        "entryEquity",
        <div className="flex items-center gap-1">
          Entry equity
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCurrency(v, 2)}</span>;
    },
  },
  {
    accessorKey: "entryMargin",
    header: () =>
      withHeaderTooltip(
        "entryMargin",
        <div className="flex items-center gap-1">
          Entry margin
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCurrency(v, 2)}</span>;
    },
  },
  {
    accessorKey: "entryFreeMargin",
    header: () =>
      withHeaderTooltip(
        "entryFreeMargin",
        <div className="flex items-center gap-1">
          Entry free margin
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCurrency(v, 2)}</span>;
    },
  },
  {
    accessorKey: "entryMarginLevel",
    header: () =>
      withHeaderTooltip(
        "entryMarginLevel",
        <div className="flex items-center gap-1">
          Entry margin level
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatPercent(v, 2)}</span>;
    },
  },
  {
    accessorKey: "entryDealCount",
    header: () =>
      withHeaderTooltip(
        "entryDealCount",
        <div className="flex items-center gap-1">
          Entry deals
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCount(v)}</span>;
    },
  },
  {
    accessorKey: "entryVolume",
    header: () =>
      withHeaderTooltip(
        "entryVolume",
        <div className="flex items-center gap-1">
          Entry volume
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatNumber(v, 2)}</span>;
    },
  },
  {
    accessorKey: "scaleInCount",
    header: () =>
      withHeaderTooltip(
        "scaleInCount",
        <div className="flex items-center gap-1">
          Scale in
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCount(v)}</span>;
    },
  },
  {
    accessorKey: "scaleOutCount",
    header: () =>
      withHeaderTooltip(
        "scaleOutCount",
        <div className="flex items-center gap-1">
          Scale out
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatCount(v)}</span>;
    },
  },
  {
    accessorKey: "trailingStopDetected",
    header: () =>
      withHeaderTooltip(
        "trailingStopDetected",
        <div className="flex items-center gap-1">
          Trailing stop
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<boolean | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className={v ? "text-teal-400" : "text-white/40"}>
          {v ? "Yes" : "No"}
        </span>
      );
    },
  },
  {
    accessorKey: "entryPeakDurationSeconds",
    header: () =>
      withHeaderTooltip(
        "entryPeakDurationSeconds",
        <div className="flex items-center gap-1">
          Time to peak
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatDuration(v)}</span>;
    },
  },
  {
    accessorKey: "postExitPeakDurationSeconds",
    header: () =>
      withHeaderTooltip(
        "postExitPeakDurationSeconds",
        <div className="flex items-center gap-1">
          Time to PE
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatDuration(v)}</span>;
    },
  },
  {
    accessorKey: "mpeManipLegR",
    header: () =>
      withHeaderTooltip(
        "mpeManipLegR",
        <div className="flex items-center gap-1">
          Maximum price excursion manipulation leg (risk units)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatNumber(v, 2)}R</span>;
    },
  },
  {
    accessorKey: "mpeManipPE_R",
    header: () =>
      withHeaderTooltip(
        "mpeManipPE_R",
        <div className="flex items-center gap-1">
          Maximum price excursion manipulation post exit (risk units)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatNumber(v, 2)}R</span>;
    },
  },
  {
    accessorKey: "maxRR",
    header: () =>
      withHeaderTooltip(
        "maxRR",
        <div className="flex items-center gap-1">
          Maximum reward to risk
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      const formatted = formatNumber(v, 2);
      return (
        <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, getMaxRRTone(v))}>
          {formatted}R
        </span>
      );
    },
  },
  {
    accessorKey: "realisedRR",
    header: () =>
      withHeaderTooltip(
        "realisedRR",
        <div className="flex items-center gap-1">
          Realised reward to risk
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      const formatted = formatNumber(v, 2);
      return (
        <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, getRealisedRRTone(v))}>
          {v > 0 ? "+" : ""}
          {formatted}R
        </span>
      );
    },
  },
  {
    accessorKey: "rrCaptureEfficiency",
    header: () =>
      withHeaderTooltip(
        "rrCaptureEfficiency",
        <div className="flex items-center gap-1">
          Reward to risk capture efficiency (percent)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      const pct = Math.round(v);
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            getEfficiencyTone(pct, 75, 50, 25)
          )}
        >
          {formatPercent(pct, 0)}
        </span>
      );
    },
  },
  {
    accessorKey: "manipRREfficiency",
    header: () =>
      withHeaderTooltip(
        "manipRREfficiency",
        <div className="flex items-center gap-1">
          Manipulation reward to risk efficiency (percent)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      const pct = Math.round(v);
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            getEfficiencyTone(pct, 100, 75, 50)
          )}
        >
          {formatPercent(pct, 0)}
        </span>
      );
    },
  },
  {
    accessorKey: "rawSTDV",
    header: () =>
      withHeaderTooltip(
        "rawSTDV",
        <div className="flex items-center gap-1">
          Raw standard deviation
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatNumber(v, 2)}</span>;
    },
  },
  {
    accessorKey: "rawSTDV_PE",
    header: () =>
      withHeaderTooltip(
        "rawSTDV_PE",
        <div className="flex items-center gap-1">
          Raw standard deviation post exit
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatNumber(v, 2)}</span>;
    },
  },
  {
    accessorKey: "stdvBucket",
    header: () =>
      withHeaderTooltip(
        "stdvBucket",
        <div className="flex items-center gap-1">
          Volatility
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<string | null | undefined>();
      if (!v) return <span className="text-white/40">—</span>;

      let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
      let label = "";
      let description = "";

      if (v.includes("-2")) {
        chipClass = TRADE_IDENTIFIER_TONES.negative;
        label = "Very Low";
        description = "Price barely moved (-2σ). Very calm conditions.";
      } else if (v.includes("-1")) {
        chipClass = TRADE_IDENTIFIER_TONES.amber;
        label = "Low";
        description = "Below average movement (-1σ). Relatively quiet.";
      } else if (v.includes("0")) {
        chipClass = TRADE_IDENTIFIER_TONES.neutral;
        label = "Normal";
        description = "Average price movement (0σ). Typical conditions.";
      } else if (v.includes("+1")) {
        chipClass = TRADE_IDENTIFIER_TONES.warning;
        label = "High";
        description = "Above average movement (+1σ). More volatile.";
      } else if (v.includes("+2")) {
        chipClass = TRADE_IDENTIFIER_TONES.positive;
        label = "Very High";
        description = "Price was very wild (+2σ). Extreme volatility.";
      }

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                "cursor-help",
                chipClass
              )}
            >
              <span className="opacity-60">{v}</span>
              <span>{label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold text-sm">{label} Volatility</div>
              <div className="text-xs text-white/70">{description}</div>
              <Separator className="bg-white/10 my-2" />
              <div className="text-[11px] text-white/50">
                Standard deviation measures how wild price moved relative to
                your typical trades.
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "estimatedWeightedMPE_R",
    header: () =>
      withHeaderTooltip(
        "estimatedWeightedMPE_R",
        <div className="flex items-center gap-1">
          Estimated weighted maximum price excursion (risk units)
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue, table }) => {
      const v = getValue<number | null | undefined>();
      const totalTrades = (table.options.meta as any)?.totalTradesCount ?? 0;
      const disableSampleGating = (table.options.meta as any)
        ?.disableSampleGating;
      const minRequired = 100;

      // If value exists, show it
      if (v != null) {
        return (
          <span
            className={cn(
              TRADE_IDENTIFIER_PILL_CLASS,
              TRADE_IDENTIFIER_TONES.info
            )}
          >
            {formatNumber(v, 2)}R
          </span>
        );
      }

      // If preferences haven't loaded yet, show loading
      if (disableSampleGating === undefined) {
        return <span className="text-white/40 text-xs">...</span>;
      }

      // If gating is disabled, explain why there's no value
      if (disableSampleGating === true) {
        return (
          <span
            className="text-white/40 text-xs"
            title="No data available for this trade (missing manipulation or post-exit data)"
          >
            —
          </span>
        );
      }

      // If gating is enabled and no value, show progress
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            TRADE_IDENTIFIER_TONES.subdued,
            "text-[10px]"
          )}
          title={`Requires minimum ${minRequired} trades for statistical reliability. Current account has ${totalTrades} trades. Enable in Settings to override.`}
        >
          {totalTrades}/{minRequired}
        </span>
      );
    },
  },
  // Intent Metrics
  {
    accessorKey: "plannedRR",
    header: () =>
      withHeaderTooltip(
        "plannedRR",
        <div className="flex items-center gap-1">
          Planned reward to risk
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return <span className="text-white/70">{formatNumber(v, 2)}R</span>;
    },
  },
  {
    accessorKey: "plannedRiskPips",
    header: () => withHeaderTooltip("plannedRiskPips", "Planned risk (pips)"),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  {
    accessorKey: "plannedTargetPips",
    header: () =>
      withHeaderTooltip("plannedTargetPips", "Planned target (pips)"),
    cell: ({ getValue, row }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      return (
        <span className="text-white/70">{formatPipValue(v, row.original)}</span>
      );
    },
  },
  // Efficiency Metrics
  {
    accessorKey: "exitEfficiency",
    header: () =>
      withHeaderTooltip(
        "exitEfficiency",
        <div className="flex items-center gap-1">
          Exit efficiency
          <Info className="size-3 text-white/40 mr-1" />
        </div>
      ),
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      const percentage = Math.round(v);
      const colorClass =
        percentage >= 80
          ? "text-teal-400"
          : percentage >= 50
          ? "text-yellow-400"
          : "text-orange-400";
      return <span className={colorClass}>{formatPercent(percentage, 0)}</span>;
    },
  },
  // Additional optional widget columns (hidden by default)
  {
    accessorKey: "drawdown",
    header: () => withHeaderTooltip("drawdown", "Max drawdown"),
    cell: ({ row }) => (
      <DrawdownCell trade={row.original as TradeRow} rowIndex={row.index} />
    ),
  },
  // Actions column
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const trade = row.original as TradeRow;
      return <TradeActionsMenu trade={trade} />;
    },
    enableSorting: false,
    enableHiding: false,
    size: 50,
    minSize: 50,
    maxSize: 96,
  },
];

export default function TradeTableInfinite() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const { ref, inView } = useInView({ rootMargin: "200px" });

  // Fetch user's advanced metrics preferences
  const advancedPrefsQuery =
    trpcOptions.users.getAdvancedMetricsPreferences.queryOptions();
  const {
    data: advancedPrefsRaw,
    isLoading: prefsLoading,
    error: prefsError,
  } = useQuery({
    ...advancedPrefsQuery,
    staleTime: 0, // Always fetch fresh to ensure settings changes are reflected
    refetchOnMount: true,
  });
  const advancedPrefs = advancedPrefsRaw as
    | AdvancedMetricsPreferences
    | undefined;

  // When preferences load, invalidate trades to recalculate metrics with new gating setting
  React.useEffect(() => {
    if (advancedPrefs) {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
    }
  }, [advancedPrefs?.disableSampleGating]);

  // URL-synced query params
  const [qParam, setQParam] = useQueryState("q", { defaultValue: "" });
  const [idsParam, setIdsParam] = useQueryState("ids", { defaultValue: "" });

  const [slParam, setSlParam] = useQueryState("sl", { defaultValue: "" });
  const [tpParam, setTpParam] = useQueryState("tp", { defaultValue: "" });

  const [dirParam, setDirParam] = useQueryState("dir", { defaultValue: "all" });
  const [symbolsParam, setSymbolsParam] = useQueryState("symbols", {
    defaultValue: "",
  });
  const [killzonesParam, setKillzonesParam] = useQueryState("killzones", {
    defaultValue: "",
  });
  const [sessionTagsParam, setSessionTagsParam] = useQueryState("sessionTags", {
    defaultValue: "",
  });
  const [modelTagsParam, setModelTagsParam] = useQueryState("modelTags", {
    defaultValue: "",
  });
  const [protocolParam, setProtocolParam] = useQueryState("protocol", {
    defaultValue: "",
  });
  const [outcomeParam, setOutcomeParam] = useQueryState("outcome", {
    defaultValue: "",
  });

  const [holdParam, setHoldParam] = useQueryState("hold", { defaultValue: "" });
  const [volParam, setVolParam] = useQueryState("vol", { defaultValue: "" });
  const [plParam, setPlParam] = useQueryState("pl", { defaultValue: "" });
  const [comParam, setComParam] = useQueryState("com", { defaultValue: "" });
  const [swapParam, setSwapParam] = useQueryState("swap", { defaultValue: "" });
  const [rrParam, setRrParam] = useQueryState("rr", { defaultValue: "" });
  const [mfeParam, setMfeParam] = useQueryState("mfe", { defaultValue: "" });
  const [maeParam, setMaeParam] = useQueryState("mae", { defaultValue: "" });
  const [effParam, setEffParam] = useQueryState("eff", { defaultValue: "" });
  const [sortParam, setSortParam] = useQueryState("sort", {
    defaultValue: "open:desc",
  });
  const [viewParam, setViewParam] = useQueryState("view", { defaultValue: "" });
  const [{ oStart, oEnd }, setRangeParams] = useQueryStates(
    {
      oStart: parseAsString.withDefault(""),
      oEnd: parseAsString.withDefault(""),
    },
    { history: "push" }
  );
  // single date range filter only (open dates), close filter removed

  // View management state
  const [manageViewsOpen, setManageViewsOpen] = React.useState(false);

  // Fetch selected view
  const viewOpts = trpcOptions.views.get.queryOptions({
    id: viewParam || "",
  });
  const { data: selectedViewRaw } = useQuery({
    ...viewOpts,
    enabled: Boolean(viewParam),
  });
  const selectedView = selectedViewRaw as SelectedTradeView | undefined;
  const selectedViewConfig = React.useMemo<SelectedTradeViewConfig | undefined>(
    () =>
      selectedView?.config && typeof selectedView.config === "object"
        ? (selectedView.config as SelectedTradeViewConfig)
        : undefined,
    [selectedView?.config]
  );

  // Derived UI state
  const q = qParam || "";
  const ids = React.useMemo(
    () => (idsParam ? idsParam.split(",").filter(Boolean) : []),
    [idsParam]
  );
  const tradeDirection: DirectionType =
    dirParam === "long" || dirParam === "short" || dirParam === "all"
      ? (dirParam as DirectionType)
      : "all";
  const symbols = React.useMemo(
    () => (symbolsParam ? symbolsParam.split(",").filter(Boolean) : []),
    [symbolsParam]
  );
  const killzones = React.useMemo(
    () => (killzonesParam ? killzonesParam.split(",").filter(Boolean) : []),
    [killzonesParam]
  );
  const sessionTags = React.useMemo(
    () => (sessionTagsParam ? sessionTagsParam.split(",").filter(Boolean) : []),
    [sessionTagsParam]
  );
  const modelTags = React.useMemo(
    () => (modelTagsParam ? modelTagsParam.split(",").filter(Boolean) : []),
    [modelTagsParam]
  );
  const protocolAlignments = React.useMemo(
    () => (protocolParam ? protocolParam.split(",").filter(Boolean) : []),
    [protocolParam]
  );
  const outcomes = React.useMemo(
    () => (outcomeParam ? outcomeParam.split(",").filter(Boolean) : []),
    [outcomeParam]
  );
  const start = oStart ? new Date(oStart) : undefined;
  const end = oEnd ? new Date(oEnd) : undefined;
  const holdRange: [number, number] | undefined = React.useMemo(
    () => parseRangeParam(holdParam),
    [holdParam]
  );
  const volRange = React.useMemo(() => parseRangeParam(volParam), [volParam]);
  const rawPlRange = React.useMemo(() => parseRangeParam(plParam), [plParam]);
  const plRange = React.useMemo(
    () => normalizeLegacyIntegerUpperBoundRange(plParam, rawPlRange),
    [plParam, rawPlRange?.[0], rawPlRange?.[1]]
  );
  const rawComRange = React.useMemo(
    () => parseRangeParam(comParam),
    [comParam]
  );
  const comRange = React.useMemo(
    () => normalizeLegacyIntegerUpperBoundRange(comParam, rawComRange),
    [comParam, rawComRange?.[0], rawComRange?.[1]]
  );
  const rawSwapRange = React.useMemo(
    () => parseRangeParam(swapParam),
    [swapParam]
  );
  const swapRange = React.useMemo(
    () => normalizeLegacyIntegerUpperBoundRange(swapParam, rawSwapRange),
    [swapParam, rawSwapRange?.[0], rawSwapRange?.[1]]
  );
  const rrRange = React.useMemo(() => parseRangeParam(rrParam), [rrParam]);
  const mfeRange = React.useMemo(() => parseRangeParam(mfeParam), [mfeParam]);
  const maeRange = React.useMemo(() => parseRangeParam(maeParam), [maeParam]);
  const efficiencyRange = React.useMemo(
    () => parseRangeParam(effParam),
    [effParam]
  );

  const slRange = React.useMemo(() => parseRangeParam(slParam), [slParam]);
  const tpRange = React.useMemo(() => parseRangeParam(tpParam), [tpParam]);

  const viewFilters = React.useMemo<TradeViewFilters>(() => {
    if (!selectedViewConfig) {
      return {};
    }
    return selectedViewConfig.filters || {};
  }, [selectedViewConfig]);

  const mergedDateRange = React.useMemo(
    () => mergeDateRange(start, end, viewFilters.dateRange),
    [
      start?.getTime(),
      end?.getTime(),
      viewFilters.dateRange?.start,
      viewFilters.dateRange?.end,
    ]
  );
  const mergedDirection = React.useMemo(
    () =>
      mergeDirectionFilter(
        tradeDirection,
        viewFilters.directions,
        viewFilters.tradeDirection
      ),
    [tradeDirection, viewFilters.directions, viewFilters.tradeDirection]
  );
  const mergedSymbols = React.useMemo(
    () => mergeArrayFilter(symbols, viewFilters.symbols),
    [symbols, viewFilters.symbols]
  );
  const mergedSessionTags = React.useMemo(
    () => mergeArrayFilter(sessionTags, viewFilters.sessionTags),
    [sessionTags, viewFilters.sessionTags]
  );
  const mergedModelTags = React.useMemo(
    () => mergeArrayFilter(modelTags, viewFilters.modelTags),
    [modelTags, viewFilters.modelTags]
  );
  const mergedProtocol = React.useMemo(
    () => mergeArrayFilter(protocolAlignments, viewFilters.protocolAlignment),
    [protocolAlignments, viewFilters.protocolAlignment]
  );
  const mergedOutcomes = React.useMemo(
    () => mergeArrayFilter(outcomes, viewFilters.outcomes),
    [outcomes, viewFilters.outcomes]
  );

  const numericFiltersFromView = viewFilters.numericFilters || {};
  const mergedHoldRange = React.useMemo(
    () => mergeNumericRange(holdRange, numericFiltersFromView.holdSeconds),
    [
      holdRange?.[0],
      holdRange?.[1],
      numericFiltersFromView.holdSeconds?.min,
      numericFiltersFromView.holdSeconds?.max,
    ]
  );
  const mergedVolRange = React.useMemo(
    () => mergeNumericRange(volRange, numericFiltersFromView.volume),
    [
      volRange?.[0],
      volRange?.[1],
      numericFiltersFromView.volume?.min,
      numericFiltersFromView.volume?.max,
    ]
  );
  const mergedPlRange = React.useMemo(
    () => mergeNumericRange(plRange, numericFiltersFromView.profit),
    [
      plRange?.[0],
      plRange?.[1],
      numericFiltersFromView.profit?.min,
      numericFiltersFromView.profit?.max,
    ]
  );
  const mergedComRange = React.useMemo(
    () => mergeNumericRange(comRange, numericFiltersFromView.commissions),
    [
      comRange?.[0],
      comRange?.[1],
      numericFiltersFromView.commissions?.min,
      numericFiltersFromView.commissions?.max,
    ]
  );
  const mergedSwapRange = React.useMemo(
    () => mergeNumericRange(swapRange, numericFiltersFromView.swap),
    [
      swapRange?.[0],
      swapRange?.[1],
      numericFiltersFromView.swap?.min,
      numericFiltersFromView.swap?.max,
    ]
  );
  const mergedSlRange = React.useMemo(
    () => mergeNumericRange(slRange, numericFiltersFromView.sl),
    [
      slRange?.[0],
      slRange?.[1],
      numericFiltersFromView.sl?.min,
      numericFiltersFromView.sl?.max,
    ]
  );
  const mergedTpRange = React.useMemo(
    () => mergeNumericRange(tpRange, numericFiltersFromView.tp),
    [
      tpRange?.[0],
      tpRange?.[1],
      numericFiltersFromView.tp?.min,
      numericFiltersFromView.tp?.max,
    ]
  );
  const mergedRrRange = React.useMemo(
    () => mergeNumericRange(rrRange, numericFiltersFromView.realisedRR),
    [
      rrRange?.[0],
      rrRange?.[1],
      numericFiltersFromView.realisedRR?.min,
      numericFiltersFromView.realisedRR?.max,
    ]
  );
  const mergedMfeRange = React.useMemo(
    () => mergeNumericRange(mfeRange, numericFiltersFromView.mfePips),
    [
      mfeRange?.[0],
      mfeRange?.[1],
      numericFiltersFromView.mfePips?.min,
      numericFiltersFromView.mfePips?.max,
    ]
  );
  const mergedMaeRange = React.useMemo(
    () => mergeNumericRange(maeRange, numericFiltersFromView.maePips),
    [
      maeRange?.[0],
      maeRange?.[1],
      numericFiltersFromView.maePips?.min,
      numericFiltersFromView.maePips?.max,
    ]
  );
  const mergedEfficiencyRange = React.useMemo(
    () =>
      mergeNumericRange(
        efficiencyRange,
        numericFiltersFromView.rrCaptureEfficiency
      ),
    [
      efficiencyRange?.[0],
      efficiencyRange?.[1],
      numericFiltersFromView.rrCaptureEfficiency?.min,
      numericFiltersFromView.rrCaptureEfficiency?.max,
    ]
  );

  const hasMergedFilterConflict =
    mergedDateRange.conflict ||
    mergedDirection.conflict ||
    mergedSymbols.conflict ||
    mergedSessionTags.conflict ||
    mergedModelTags.conflict ||
    mergedProtocol.conflict ||
    mergedOutcomes.conflict ||
    mergedHoldRange.conflict ||
    mergedVolRange.conflict ||
    mergedPlRange.conflict ||
    mergedComRange.conflict ||
    mergedSwapRange.conflict ||
    mergedSlRange.conflict ||
    mergedTpRange.conflict ||
    mergedRrRange.conflict ||
    mergedMfeRange.conflict ||
    mergedMaeRange.conflict ||
    mergedEfficiencyRange.conflict;

  const effectiveTradeDirection = mergedDirection.value;
  const effectiveSymbols = mergedSymbols.values;
  const effectiveSessionTags = mergedSessionTags.values;
  const effectiveModelTags = mergedModelTags.values;
  const effectiveProtocolAlignments = mergedProtocol.values;
  const effectiveOutcomes = mergedOutcomes.values;
  const effectiveClosedOutcomes = React.useMemo(
    () =>
      effectiveOutcomes.filter(
        (outcome): outcome is Exclude<OutcomeFilterValue, "Live"> =>
          outcome !== "Live"
      ),
    [effectiveOutcomes]
  );
  const onlyLiveOutcomeSelected =
    effectiveOutcomes.length > 0 && effectiveClosedOutcomes.length === 0;
  const effectiveHoldRange = mergedHoldRange.range;
  const effectiveVolRange = mergedVolRange.range;
  const effectivePlRange = mergedPlRange.range;
  const effectiveComRange = mergedComRange.range;
  const effectiveSwapRange = mergedSwapRange.range;
  const effectiveSlRange = mergedSlRange.range;
  const effectiveTpRange = mergedTpRange.range;
  const effectiveRrRange = mergedRrRange.range;
  const effectiveMfeRange = mergedMfeRange.range;
  const effectiveMaeRange = mergedMaeRange.range;
  const effectiveEfficiencyRange = mergedEfficiencyRange.range;

  const [statFilters, setStatFilters] = React.useState<{
    rrMin?: number;
    rrMax?: number;
    mfeMin?: number;
    mfeMax?: number;
    maeMin?: number;
    maeMax?: number;
    efficiencyMin?: number;
    efficiencyMax?: number;
  }>({});

  React.useEffect(() => {
    setStatFilters({
      rrMin: rrRange?.[0],
      rrMax: rrRange?.[1],
      mfeMin: mfeRange?.[0],
      mfeMax: mfeRange?.[1],
      maeMin: maeRange?.[0],
      maeMax: maeRange?.[1],
      efficiencyMin: efficiencyRange?.[0],
      efficiencyMax: efficiencyRange?.[1],
    });
  }, [
    rrRange?.[0],
    rrRange?.[1],
    mfeRange?.[0],
    mfeRange?.[1],
    maeRange?.[0],
    maeRange?.[1],
    efficiencyRange?.[0],
    efficiencyRange?.[1],
  ]);

  // Per-account bounds for picker presets (earliest open .. latest open)
  const boundsOpts = trpcOptions.accounts.opensBounds.queryOptions({
    accountId: accountId || "",
  });
  const { data: boundsRaw } = useQuery({
    ...boundsOpts,
    enabled: Boolean(accountId),
  });
  const bounds = boundsRaw as AccountOpenBounds | undefined;
  const minBound = bounds?.minISO ? new Date(bounds.minISO) : undefined;
  const maxBound = bounds?.maxISO ? new Date(bounds.maxISO) : undefined;

  // All symbols for account
  const symbolsOpts = trpcOptions.trades.listSymbols.queryOptions({
    accountId: accountId || "",
  });
  const { data: allSymbolsRaw } = useQuery({
    ...symbolsOpts,
    enabled: Boolean(accountId),
  });
  const allSymbols = React.useMemo(
    () => (allSymbolsRaw as string[] | undefined) ?? [],
    [allSymbolsRaw]
  );
  // All killzones for account
  const killzonesOpts = trpcOptions.trades.listKillzones.queryOptions({
    accountId: accountId || "",
  });
  const { data: allKillzonesRaw } = useQuery({
    ...killzonesOpts,
    enabled: Boolean(accountId),
  });
  const allKillzones = React.useMemo(
    () => (allKillzonesRaw as NamedColorTag[] | undefined) ?? [],
    [allKillzonesRaw]
  );
  // All session tags for account
  const sessionTagsOpts = trpcOptions.trades.listSessionTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: allSessionTagsRaw } = useQuery({
    ...sessionTagsOpts,
    enabled: Boolean(accountId),
  });
  const allSessionTags = React.useMemo(
    () => (allSessionTagsRaw as NamedColorTag[] | undefined) ?? [],
    [allSessionTagsRaw]
  );
  // All model tags for account
  const modelTagsOpts = trpcOptions.trades.listModelTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: allModelTagsRaw } = useQuery({
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
  const { data: acctStatsRaw } = useQuery({
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
  const liveTradeSignature = React.useMemo(() => {
    const openTrades =
      (
        liveMetrics as
          | {
              openTrades?: Array<{
                accountId?: string | null;
                ticket?: string | null;
                id?: string | null;
              }>;
            }
          | undefined
      )?.openTrades ?? [];

    return openTrades
      .map(
        (trade) => `${trade.accountId ?? ""}:${trade.ticket ?? trade.id ?? ""}`
      )
      .filter(Boolean)
      .sort()
      .join("|");
  }, [liveMetrics]);
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

  // Fetch sample gate status
  const sampleGateOpts = trpcOptions.trades.getSampleGateStatus.queryOptions({
    accountId: accountId || "",
  });
  const { data: sampleGateStatusRaw } = useQuery({
    ...sampleGateOpts,
    enabled: Boolean(accountId),
  });
  const sampleGateStatus = sampleGateStatusRaw as
    | SampleGateStatusRow[]
    | undefined;

  const infiniteOpts = trpcOptions.trades.listInfinite.infiniteQueryOptions(
    {
      accountId: accountId || "",
      limit: ids.length ? Math.min(Math.max(ids.length, 50), 200) : 50,
      q: q || undefined,
      tradeDirection:
        effectiveTradeDirection === "all"
          ? undefined
          : (effectiveTradeDirection as "long" | "short"),
      ids:
        hasMergedFilterConflict || onlyLiveOutcomeSelected
          ? [NO_RESULTS_FILTER_ID]
          : ids,
      symbols: effectiveSymbols.length ? effectiveSymbols : undefined,
      killzones: killzones.length ? killzones : undefined,
      sessionTags: effectiveSessionTags.length
        ? effectiveSessionTags
        : undefined,
      modelTags: effectiveModelTags.length ? effectiveModelTags : undefined,
      protocolAlignment: effectiveProtocolAlignments.length
        ? (effectiveProtocolAlignments as any)
        : undefined,
      outcomes: effectiveClosedOutcomes.length
        ? (effectiveClosedOutcomes as any)
        : undefined,
      startISO: mergedDateRange.start?.toISOString(),
      endISO: mergedDateRange.end?.toISOString(),
      holdMin:
        effectiveHoldRange && Number.isFinite(effectiveHoldRange[0])
          ? effectiveHoldRange[0]
          : undefined,
      holdMax:
        effectiveHoldRange && Number.isFinite(effectiveHoldRange[1])
          ? effectiveHoldRange[1]
          : undefined,
      volumeMin:
        effectiveVolRange && Number.isFinite(effectiveVolRange[0])
          ? effectiveVolRange[0]
          : undefined,
      volumeMax:
        effectiveVolRange && Number.isFinite(effectiveVolRange[1])
          ? effectiveVolRange[1]
          : undefined,
      profitMin:
        effectivePlRange && Number.isFinite(effectivePlRange[0])
          ? effectivePlRange[0]
          : undefined,
      profitMax:
        effectivePlRange && Number.isFinite(effectivePlRange[1])
          ? effectivePlRange[1]
          : undefined,
      commissionsMin:
        effectiveComRange && Number.isFinite(effectiveComRange[0])
          ? effectiveComRange[0]
          : undefined,
      commissionsMax:
        effectiveComRange && Number.isFinite(effectiveComRange[1])
          ? effectiveComRange[1]
          : undefined,
      swapMin:
        effectiveSwapRange && Number.isFinite(effectiveSwapRange[0])
          ? effectiveSwapRange[0]
          : undefined,
      swapMax:
        effectiveSwapRange && Number.isFinite(effectiveSwapRange[1])
          ? effectiveSwapRange[1]
          : undefined,
      slMin:
        effectiveSlRange && Number.isFinite(effectiveSlRange[0])
          ? effectiveSlRange[0]
          : undefined,
      slMax:
        effectiveSlRange && Number.isFinite(effectiveSlRange[1])
          ? effectiveSlRange[1]
          : undefined,
      tpMin:
        effectiveTpRange && Number.isFinite(effectiveTpRange[0])
          ? effectiveTpRange[0]
          : undefined,
      tpMax:
        effectiveTpRange && Number.isFinite(effectiveTpRange[1])
          ? effectiveTpRange[1]
          : undefined,
      rrMin:
        effectiveRrRange && Number.isFinite(effectiveRrRange[0])
          ? effectiveRrRange[0]
          : undefined,
      rrMax:
        effectiveRrRange && Number.isFinite(effectiveRrRange[1])
          ? effectiveRrRange[1]
          : undefined,
      mfeMin:
        effectiveMfeRange && Number.isFinite(effectiveMfeRange[0])
          ? effectiveMfeRange[0]
          : undefined,
      mfeMax:
        effectiveMfeRange && Number.isFinite(effectiveMfeRange[1])
          ? effectiveMfeRange[1]
          : undefined,
      maeMin:
        effectiveMaeRange && Number.isFinite(effectiveMaeRange[0])
          ? effectiveMaeRange[0]
          : undefined,
      maeMax:
        effectiveMaeRange && Number.isFinite(effectiveMaeRange[1])
          ? effectiveMaeRange[1]
          : undefined,
      efficiencyMin:
        effectiveEfficiencyRange && Number.isFinite(effectiveEfficiencyRange[0])
          ? effectiveEfficiencyRange[0]
          : undefined,
      efficiencyMax:
        effectiveEfficiencyRange && Number.isFinite(effectiveEfficiencyRange[1])
          ? effectiveEfficiencyRange[1]
          : undefined,
    },
    { getNextPageParam: (last: any) => last?.nextCursor }
  );

  // No need to manually remove queries; query key already changes when server-side filters change

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({ ...infiniteOpts, enabled: Boolean(accountId) });

  // Load more only when sentinel in view

  const rows = React.useMemo<TradeRow[]>(() => {
    const pages = (data as any)?.pages as
      | Array<{ items: TradeRow[] }>
      | undefined;
    if (!pages) return [];
    return pages.flatMap((p) => p.items);
  }, [data]);

  const liveRows = React.useMemo<TradeRow[]>(() => {
    const openTrades = (liveMetrics as any)?.openTrades || [];
    const now = Date.now();
    return openTrades.map((trade: any) => {
      const openTimeISO = trade.openTime;
      const openMs = Date.parse(openTimeISO);
      const holdSeconds = Number.isNaN(openMs)
        ? 0
        : Math.max(0, Math.floor((now - openMs) / 1000));
      return {
        id: trade.id,
        symbol: trade.symbol,
        tradeDirection: trade.tradeType,
        volume: trade.volume,
        profit: trade.profit,
        commissions: trade.commission,
        swap: trade.swap,
        tp: trade.tp ?? 0,
        sl: trade.sl ?? 0,
        open: openTimeISO,
        close: new Date().toISOString(),
        closeText: "Live",
        createdAtISO: openTimeISO,
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
  }, [(liveMetrics as any)?.openTrades]);

  const baseRows = React.useMemo<TradeRow[]>(
    () => [...liveRows, ...rows],
    [liveRows, rows]
  );

  // Extract total trades count from first page (consistent across all pages)
  const totalTradesCount = React.useMemo(() => {
    const pages = (data as any)?.pages as
      | Array<{ totalTradesCount?: number }>
      | undefined;
    return pages?.[0]?.totalTradesCount ?? 0;
  }, [data]);

  const [ddMode, setDdMode] = useQueryState("dd", { defaultValue: "percent" });
  const [dukaDebug, setDukaDebug] = useQueryState("duka", {
    defaultValue: "0",
  });
  const [groupBy, setGroupBy] = React.useState<string | null>(null);
  const idsSet = React.useMemo(() => new Set(ids), [ids]);
  const killzoneSet = React.useMemo(() => new Set(killzones), [killzones]);
  const sessionTagSet = React.useMemo(
    () => new Set(effectiveSessionTags),
    [effectiveSessionTags]
  );
  const modelTagSet = React.useMemo(
    () => new Set(effectiveModelTags),
    [effectiveModelTags]
  );
  const protocolSet = React.useMemo(
    () => new Set(effectiveProtocolAlignments),
    [effectiveProtocolAlignments]
  );
  const outcomeSet = React.useMemo(
    () => new Set(effectiveOutcomes),
    [effectiveOutcomes]
  );
  const symbolSet = React.useMemo(
    () => new Set(effectiveSymbols),
    [effectiveSymbols]
  );

  const applyClientFilters = React.useCallback(
    (
      rowsToFilter: TradeRow[],
      excluded: Set<
        | "ids"
        | "direction"
        | "symbols"
        | "date"
        | "hold"
        | "vol"
        | "pl"
        | "com"
        | "swap"
        | "sl"
        | "tp"
        | "rr"
        | "mfe"
        | "mae"
        | "eff"
      > = new Set()
    ) => {
      if (hasMergedFilterConflict) return [] as TradeRow[];

      return rowsToFilter.filter((row) => {
        if (!excluded.has("ids") && idsSet.size > 0 && !idsSet.has(row.id)) {
          return false;
        }
        if (
          !excluded.has("direction") &&
          effectiveTradeDirection !== "all" &&
          row.tradeDirection !== effectiveTradeDirection
        ) {
          return false;
        }
        if (
          !excluded.has("symbols") &&
          symbolSet.size > 0 &&
          !symbolSet.has(row.symbol)
        ) {
          return false;
        }
        if (killzoneSet.size > 0 && !killzoneSet.has(row.killzone || "")) {
          return false;
        }
        if (
          sessionTagSet.size > 0 &&
          !sessionTagSet.has(row.sessionTag || "")
        ) {
          return false;
        }
        if (modelTagSet.size > 0 && !modelTagSet.has(row.modelTag || "")) {
          return false;
        }
        if (
          protocolSet.size > 0 &&
          !protocolSet.has((row.protocolAlignment || "") as any)
        ) {
          return false;
        }
        const rowOutcome = row.isLive ? "Live" : row.outcome || "";
        if (outcomeSet.size > 0 && !outcomeSet.has(rowOutcome as any)) {
          return false;
        }
        if (
          !excluded.has("date") &&
          !isTradeWithinDateRange(
            row,
            mergedDateRange.start,
            mergedDateRange.end
          )
        ) {
          return false;
        }
        if (q && !row.symbol.toLowerCase().includes(q.toLowerCase())) {
          return false;
        }
        if (
          !excluded.has("hold") &&
          !isValueInRange(row.holdSeconds, effectiveHoldRange)
        ) {
          return false;
        }
        if (
          !excluded.has("vol") &&
          !isValueInRange(row.volume, effectiveVolRange)
        ) {
          return false;
        }
        if (
          !excluded.has("pl") &&
          !isValueInRange(row.profit, effectivePlRange)
        ) {
          return false;
        }
        if (
          !excluded.has("com") &&
          !isValueInRange(Number(row.commissions || 0), effectiveComRange)
        ) {
          return false;
        }
        if (
          !excluded.has("swap") &&
          !isValueInRange(Number(row.swap || 0), effectiveSwapRange)
        ) {
          return false;
        }
        if (!excluded.has("sl") && !isValueInRange(row.sl, effectiveSlRange)) {
          return false;
        }
        if (!excluded.has("tp") && !isValueInRange(row.tp, effectiveTpRange)) {
          return false;
        }
        if (
          !excluded.has("rr") &&
          !isValueInRange(row.realisedRR, effectiveRrRange)
        ) {
          return false;
        }
        if (
          !excluded.has("mfe") &&
          !isValueInRange(row.mfePips, effectiveMfeRange)
        ) {
          return false;
        }
        if (
          !excluded.has("mae") &&
          !isValueInRange(row.maePips, effectiveMaeRange)
        ) {
          return false;
        }
        if (
          !excluded.has("eff") &&
          !isValueInRange(row.rrCaptureEfficiency, effectiveEfficiencyRange)
        ) {
          return false;
        }
        return true;
      });
    },
    [
      effectiveComRange,
      effectiveEfficiencyRange,
      effectiveHoldRange,
      effectiveMaeRange,
      effectiveMfeRange,
      effectiveModelTags,
      effectiveOutcomes,
      effectivePlRange,
      effectiveProtocolAlignments,
      effectiveRrRange,
      effectiveSessionTags,
      effectiveSlRange,
      effectiveSwapRange,
      effectiveSymbols,
      effectiveTpRange,
      effectiveTradeDirection,
      effectiveVolRange,
      hasMergedFilterConflict,
      idsSet,
      killzoneSet,
      mergedDateRange.end,
      mergedDateRange.start,
      modelTagSet,
      outcomeSet,
      protocolSet,
      q,
      sessionTagSet,
      symbolSet,
    ]
  );

  const displayRows = React.useMemo<TradeRow[]>(
    () => applyClientFilters(baseRows),
    [applyClientFilters, baseRows]
  );

  const rowsForHoldPreview = React.useMemo<TradeRow[]>(
    () => applyClientFilters(baseRows, new Set(["hold"])),
    [applyClientFilters, baseRows]
  );

  const buildPreview = (
    exclude:
      | "hold"
      | "vol"
      | "pl"
      | "com"
      | "swap"
      | "rr"
      | "mfe"
      | "mae"
      | "eff"
  ) => applyClientFilters(baseRows, new Set([exclude]));

  const rrHistogram = React.useMemo(
    () =>
      buildPreview("rr")
        .map((r) => r.realisedRR)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );
  const mfeHistogram = React.useMemo(
    () =>
      buildPreview("mfe")
        .map((r) => r.mfePips)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );
  const maeHistogram = React.useMemo(
    () =>
      buildPreview("mae")
        .map((r) => r.maePips)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );
  const efficiencyHistogram = React.useMemo(
    () =>
      buildPreview("eff")
        .map((r) => r.rrCaptureEfficiency)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );

  const rowsForSymbolPreview = React.useMemo<TradeRow[]>(
    () => applyClientFilters(baseRows, new Set(["symbols"])),
    [applyClientFilters, baseRows]
  );

  const symbolCounts = React.useMemo(() => {
    const rec: Record<string, number> = {};
    for (const r of rowsForSymbolPreview) {
      rec[r.symbol] = (rec[r.symbol] || 0) + 1;
    }
    return rec;
  }, [rowsForSymbolPreview]);
  const symbolTotal = rowsForSymbolPreview.length;

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Compute initial column visibility based on selected view
  const initialVisibility = React.useMemo(() => {
    if (!viewParam) {
      const visibility: Record<string, boolean> = {};
      columns.forEach((col: any) => {
        const colId = col.accessorKey || col.id;
        if (colId) visibility[colId] = true;
      });
      return visibility;
    }

    // If a view is selected and has visible columns config, use it
    if (
      selectedViewConfig?.visibleColumns &&
      Array.isArray(selectedViewConfig.visibleColumns) &&
      selectedViewConfig.visibleColumns.length > 0
    ) {
      const visibleSet = new Set(selectedViewConfig.visibleColumns);
      const visibility: Record<string, boolean> = {};

      // Set all columns to false by default, then enable only those in visibleColumns
      columns.forEach((col: any) => {
        const colId = col.accessorKey || col.id;
        if (colId) {
          visibility[colId] = visibleSet.has(colId);
        }
      });

      return visibility;
    }

    const coreColumns = new Set([
      "select",
      "symbol",
      "tradeDirection",
      "open",
      "close",
      "holdSeconds",
      "volume",
      "profit",
      "commissions",
      "swap",
    ]);

    const visibility: Record<string, boolean> = {};
    columns.forEach((col: any) => {
      const colId = col.accessorKey || col.id;
      if (!colId) return;
      visibility[colId] = coreColumns.has(colId);
    });
    return visibility;
  }, [selectedViewConfig, viewParam]);
  const initialSizing = React.useMemo(() => {
    const sizing = { ...DEFAULT_COLUMN_SIZES } as Record<string, number>;

    columns.forEach((col: any, index: number) => {
      const columnId = col.id || col.accessorKey || `col_${index}`;
      if (typeof col.size === "number") {
        sizing[columnId] = col.size;
      }
    });

    return sizing;
  }, []);

  const { table, sorting, setSorting, setColumnVisibility } =
    useDataTable<TradeRow>({
      data: displayRows,
      columns,
      tableId: "trades",
      disablePreferences: !viewParam,
      meta: {
        totalTradesCount,
        disableSampleGating: advancedPrefs?.disableSampleGating, // Don't default to false - let undefined pass through
      },
      initialVisibility,
      initialSizing,
      getRowId: (row) => row.id, // Use trade ID as row ID
    });

  // Update column visibility when view changes
  React.useEffect(() => {
    if (!viewParam) {
      const visibility: Record<string, boolean> = {};
      columns.forEach((col: any) => {
        const colId = col.accessorKey || col.id;
        if (colId) visibility[colId] = true;
      });
      setColumnVisibility(visibility);
      return;
    }

    if (selectedViewConfig?.visibleColumns?.length) {
      if (
        Array.isArray(selectedViewConfig.visibleColumns) &&
        selectedViewConfig.visibleColumns.length > 0
      ) {
        const visibleSet = new Set(selectedViewConfig.visibleColumns);
        const visibility: Record<string, boolean> = {};

        // Set all columns to false by default, then enable only those in visibleColumns
        columns.forEach((col: any) => {
          const colId = col.accessorKey || col.id;
          if (colId) {
            visibility[colId] = visibleSet.has(colId);
          }
        });

        setColumnVisibility(visibility);
      }
    }
  }, [selectedView?.id, selectedViewConfig, setColumnVisibility, viewParam]); // Only trigger when view ID changes

  const [openSheet, setOpenSheet] = React.useState(false);
  const [selectedTrade, setSelectedTrade] = React.useState<TradeRow | null>(
    null
  );
  const handleRowClick = React.useCallback((row: TradeRow) => {
    setSelectedTrade(row);
    setOpenSheet(true);
  }, []);

  const formatSheetDate = React.useCallback((iso: string) => {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day} ${month}' ${year}`;
  }, []);
  const isSameCalendarDate = React.useCallback((aIso: string, bIso: string) => {
    const a = new Date(aIso);
    const b = new Date(bIso);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
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

  // Note: URL is updated by toolbar events; no sorting->URL effect to avoid loops

  // Listen for toolbar apply-sort events
  React.useEffect(() => {
    function onApplySort(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (!detail) return;
      const [id, dir] = String(detail).split(":");
      if (!id) return;
      setSorting([{ id, desc: dir === "desc" }] as any);
      setSortParam(detail || null);
    }
    function onClearSort() {
      setSorting([{ id: "open", desc: true }] as any);
      setSortParam("open:desc");
    }
    globalThis.addEventListener("apply-sort", onApplySort as any);
    globalThis.addEventListener("clear-sort", onClearSort as any);
    return () => {
      globalThis.removeEventListener("apply-sort", onApplySort as any);
      globalThis.removeEventListener("clear-sort", onClearSort as any);
    };
  }, [setSorting, setSortParam]);

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
  const selectedTradeIds = React.useMemo(() => {
    const rowSelection = table.getState().rowSelection;
    // Keys in rowSelection are the actual trade IDs now
    return new Set(Object.keys(rowSelection).filter((id) => rowSelection[id]));
  }, [table.getState().rowSelection]);
  const selectedTrades = React.useMemo(
    () =>
      table.getSelectedRowModel().rows.map((row) => row.original as TradeRow),
    [table, table.getState().rowSelection, displayRows]
  );
  const visibleColumnIds = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .filter((id) => id !== "select" && id !== "actions"),
    [table, table.getState().columnVisibility]
  );
  const [compareOpen, setCompareOpen] = React.useState(false);
  const lastHandledIdsParamRef = React.useRef<string>("");

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
        start={start}
        end={end}
        minBound={minBound}
        maxBound={maxBound}
        allSymbols={allSymbols}
        holdMin={holdRange?.[0]}
        holdMax={holdRange?.[1]}
        holdHistogram={rowsForHoldPreview.map((r) => r.holdSeconds)}
        onHoldCommit={(lo, hi) => setHoldParam(serializeIntegerRange(lo, hi))}
        onHoldClear={() => setHoldParam(null)}
        volumeMin={volRange?.[0]}
        volumeMax={volRange?.[1]}
        volumeHistogram={buildPreview("vol").map((r) => r.volume)}
        onVolumeCommit={(lo, hi) =>
          setVolParam(serializeDecimalRange(lo, hi, 4))
        }
        onVolumeClear={() => setVolParam(null)}
        profitMin={rawPlRange?.[0]}
        profitMax={rawPlRange?.[1]}
        profitHistogram={buildPreview("pl").map((r) => r.profit)}
        onProfitCommit={(lo, hi) =>
          setPlParam(serializeDecimalRange(lo, hi, 2))
        }
        onProfitClear={() => setPlParam(null)}
        commissionsMin={rawComRange?.[0]}
        commissionsMax={rawComRange?.[1]}
        commissionsHistogram={buildPreview("com").map((r) =>
          Number(r.commissions || 0)
        )}
        onCommissionsCommit={(lo, hi) =>
          setComParam(serializeDecimalRange(lo, hi, 2))
        }
        onCommissionsClear={() => setComParam(null)}
        swapMin={rawSwapRange?.[0]}
        swapMax={rawSwapRange?.[1]}
        swapHistogram={buildPreview("swap").map((r) => Number(r.swap || 0))}
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
        ddMode={ddMode as any as "pips" | "percent" | "usd"}
        onDdModeChange={(m) => setDdMode(m)}
        dukaDebug={dukaDebug === "1"}
        onDukaDebugChange={(enabled) => setDukaDebug(enabled ? "1" : "0")}
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

      {/* Smart Grouping Summary */}
      {groupBy &&
        displayRows.length > 0 &&
        (() => {
          const getGroupKey = (r: TradeRow): string => {
            switch (groupBy) {
              case "symbol":
                return r.symbol || "Unknown";
              case "session":
                return r.sessionTag || "Untagged";
              case "day":
                return r.open
                  ? new Date(r.open).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Unknown";
              case "direction":
                return r.tradeDirection === "long" ? "Long" : "Short";
              case "outcome":
                return r.outcome || "Unknown";
              default:
                return "All";
            }
          };
          const groups = new Map<
            string,
            { trades: number; profit: number; wins: number }
          >();
          for (const r of displayRows) {
            const key = getGroupKey(r);
            const g = groups.get(key) || { trades: 0, profit: 0, wins: 0 };
            g.trades++;
            g.profit += r.profit || 0;
            if (r.outcome === "Win" || r.outcome === "PW") g.wins++;
            groups.set(key, g);
          }
          const sorted = Array.from(groups.entries()).sort(
            (a, b) => b[1].profit - a[1].profit
          );
          return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-sidebar border-b border-white/5 overflow-x-auto">
              <span className="text-[9px] text-white/30 shrink-0 uppercase tracking-wider mr-1">
                Groups:
              </span>
              {sorted.map(([key, g]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-sidebar-accent border border-white/5 shrink-0"
                >
                  <span className="text-[10px] text-white/70 font-medium">
                    {key}
                  </span>
                  <span className="text-[9px] text-white/30">{g.trades}t</span>
                  <span
                    className={cn(
                      "text-[9px] font-medium",
                      g.profit >= 0 ? "text-teal-400" : "text-rose-400"
                    )}
                  >
                    {formatCurrencyValue(g.profit, {
                      showPlus: true,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="text-[9px] text-white/25">
                    {g.trades > 0 ? Math.round((g.wins / g.trades) * 100) : 0}%w
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

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
        onRowClick={handleRowClick}
        onRowMouseDown={dragSelect.handleMouseDown}
        onRowMouseEnter={dragSelect.handleMouseEnter}
        containerRef={dragSelect.containerRef}
      />

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
          onClear={() => {
            table.resetRowSelection();
            dragSelect.clearSelection();
          }}
        />
      )}

      <div ref={ref} className="py-6 text-center text-xs text-white/40">
        {isFetchingNextPage
          ? "Loading more..."
          : hasNextPage
          ? "Scroll to load more"
          : "You've reached the end of all trades for this account."}
      </div>

      <TradeComparisonSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        trades={selectedTrades}
      />

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto rounded-md p-0"
        >
          <div className="px-6 py-5 pb-0">
            <SheetHeader className="p-0">
              {selectedTrade ? (
                <div className="flex justify-between w-full items-end">
                  <div className="flex flex-col items-start">
                    <SheetTitle className="text-base font-semibold text-white">
                      {selectedTrade.symbol}
                    </SheetTitle>
                  </div>

                  <div className="flex flex-col gap-1 text-xs items-end">
                    <div className="flex items-center gap-2 text-white/40 font-medium">
                      {(() => {
                        const same = isSameCalendarDate(
                          selectedTrade.open,
                          selectedTrade.close
                        );
                        return same ? (
                          <span>{formatSheetDate(selectedTrade.open)}</span>
                        ) : (
                          <>
                            <span>{formatSheetDate(selectedTrade.open)}</span>
                            <span>-</span>
                            <span>{formatSheetDate(selectedTrade.close)}</span>
                          </>
                        );
                      })()}
                    </div>
                    <span className="font-medium tracking-wide">
                      {(() => {
                        const s = Number(selectedTrade.holdSeconds || 0);
                        const h = Math.floor(s / 3600);
                        const m = Math.floor((s % 3600) / 60);
                        return `Hold time - ${h > 0 ? `${h}h ${m}m` : `${m}m`}`;
                      })()}
                    </span>
                  </div>
                </div>
              ) : null}
            </SheetHeader>
          </div>

          {selectedTrade ? (
            <div className="flex flex-col">
              {/* P&L & Direction */}
              <Separator />
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-white/50 text-xs">P&L</span>
                    <div
                      className={cn(
                        TRADE_SURFACE_CARD_CLASS,
                        getProfitTone(selectedTrade.profit),
                        "px-4 py-2 text-sm font-semibold"
                      )}
                    >
                      {formatCurrencyValue(Number(selectedTrade.profit), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-white/50 text-xs">Direction</span>
                    <div
                      className={cn(
                        TRADE_SURFACE_CARD_CLASS,
                        getTradeDirectionTone(selectedTrade.tradeDirection),
                        "px-4 py-2 text-sm font-semibold capitalize flex items-center gap-2"
                      )}
                    >
                      {selectedTrade.tradeDirection}
                      {selectedTrade.tradeDirection === "long" ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : (
                        <ArrowDownRight className="size-3.5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Trade Basics */}
              <div className="px-6 py-3">
                <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                  Trade details
                </h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Entry price</span>
                    <span className="font-medium">
                      {selectedTrade.openPrice?.toFixed(5) || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Exit price</span>
                    <span className="font-medium">
                      {selectedTrade.closePrice?.toFixed(5) || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Stop loss</span>
                    <span className="font-medium">
                      {selectedTrade.sl?.toFixed(5) || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Take profit</span>
                    <span className="font-medium">
                      {selectedTrade.tp?.toFixed(5) || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Volume</span>
                    <span className="font-medium">
                      {formatNumberValue(selectedTrade.volume, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      lots
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Pips</span>
                    <span className="font-medium">
                      {selectedTrade.pips?.toFixed(1) || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Metrics */}
              <div className="px-6 py-3">
                <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                  Performance
                </h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {selectedTrade.realisedRR != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Realised RR</span>
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          getRealisedRRTone(Number(selectedTrade.realisedRR))
                        )}
                      >
                        {Number(selectedTrade.realisedRR) > 0 ? "+" : ""}
                        {Number(selectedTrade.realisedRR).toFixed(2)}R
                      </span>
                    </div>
                  )}
                  {selectedTrade.maxRR != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Max RR</span>
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          getMaxRRTone(Number(selectedTrade.maxRR))
                        )}
                      >
                        {Number(selectedTrade.maxRR).toFixed(2)}R
                      </span>
                    </div>
                  )}
                  {selectedTrade.rrCaptureEfficiency != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">RR efficiency</span>
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          getEfficiencyTone(
                            Number(selectedTrade.rrCaptureEfficiency),
                            75,
                            50,
                            25
                          )
                        )}
                      >
                        {Number(selectedTrade.rrCaptureEfficiency).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {selectedTrade.exitEfficiency != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Exit efficiency</span>
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          getExitEfficiencyTone(
                            Number(selectedTrade.exitEfficiency)
                          )
                        )}
                      >
                        {Number(selectedTrade.exitEfficiency).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {selectedTrade.mfePips != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">MFE</span>
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          TRADE_IDENTIFIER_TONES.positive
                        )}
                      >
                        {formatPipValue(selectedTrade.mfePips, selectedTrade)}
                      </span>
                    </div>
                  )}
                  {selectedTrade.maePips != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">MAE</span>
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          TRADE_IDENTIFIER_TONES.negative
                        )}
                      >
                        {formatPipValue(selectedTrade.maePips, selectedTrade)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Costs */}
              <div className="px-6 py-3">
                <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                  Costs
                </h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Commissions</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getCommissionTone(
                          Number(selectedTrade.commissions || 0)
                        )
                      )}
                    >
                      {formatCurrencyValue(
                        Math.abs(Number(selectedTrade.commissions || 0)),
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Swap</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getSwapTone(Number(selectedTrade.swap || 0))
                      )}
                    >
                      {formatCurrencyValue(Number(selectedTrade.swap || 0), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {selectedTrade.entrySpreadPips != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Entry spread</span>
                      <span className="font-medium">
                        {formatPipValue(
                          selectedTrade.entrySpreadPips,
                          selectedTrade
                        )}
                      </span>
                    </div>
                  )}
                  {selectedTrade.exitSpreadPips != null && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Exit spread</span>
                      <span className="font-medium">
                        {formatPipValue(
                          selectedTrade.exitSpreadPips,
                          selectedTrade
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Score */}
              {(selectedTrade.rrCaptureEfficiency != null ||
                selectedTrade.exitEfficiency != null ||
                selectedTrade.manipRREfficiency != null) && (
                <>
                  <Separator />
                  <div className="px-6 py-3">
                    <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                      Execution score
                    </h3>
                  </div>
                  <Separator />
                  <div className="px-6 py-5 space-y-3">
                    <div className="flex gap-2">
                      {[
                        {
                          label: "RR capture",
                          value: selectedTrade.rrCaptureEfficiency,
                        },
                        {
                          label: "Exit timing",
                          value: selectedTrade.exitEfficiency,
                        },
                        {
                          label: "Manip capture",
                          value: selectedTrade.manipRREfficiency,
                        },
                      ]
                        .filter((m) => m.value != null)
                        .map((m) => {
                          const v = Number(m.value);
                          const color =
                            v >= 80
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : v >= 50
                              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                              : "text-red-400 bg-red-500/10 border-red-500/20";
                          return (
                            <div
                              key={m.label}
                              className={cn(
                                TRADE_SURFACE_CARD_CLASS,
                                "flex-1 p-2 text-center",
                                color
                              )}
                            >
                              <div className="text-lg font-bold tabular-nums">
                                {v.toFixed(0)}%
                              </div>
                              <div className="text-[10px] opacity-70">
                                {m.label}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}

              {/* Trade Cost Breakdown */}
              {(() => {
                const commission = Math.abs(
                  Number(selectedTrade.commissions || 0)
                );
                const swap = Math.abs(
                  Math.min(0, Number(selectedTrade.swap || 0))
                );
                const grossPnl =
                  Number(selectedTrade.profit || 0) + commission + swap;
                const totalCost = commission + swap;
                const costPct =
                  grossPnl !== 0 ? (totalCost / Math.abs(grossPnl)) * 100 : 0;
                const commissionPct =
                  totalCost > 0 ? (commission / totalCost) * 100 : 0;
                const swapPct = Math.max(0, 100 - commissionPct);
                if (totalCost <= 0) return null;
                return (
                  <>
                    <Separator />
                    <div className="px-6 py-3">
                      <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                        Cost analysis
                      </h3>
                    </div>
                    <Separator />
                    <div className="px-6 py-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/50">Gross P&L</span>
                          <span
                            className={cn(
                              "font-medium",
                              grossPnl >= 0 ? "text-teal-400" : "text-rose-400"
                            )}
                          >
                            {formatCurrencyValue(grossPnl, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/50">Total costs</span>
                          <span className="font-medium text-rose-400">
                            {formatCurrencyValue(-totalCost, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="h-3.5 overflow-hidden bg-white/5">
                            <div
                              className="flex h-full"
                              style={{ width: `${Math.min(costPct, 100)}%` }}
                            >
                              {commission > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="h-full"
                                      style={{
                                        width: `${commissionPct}%`,
                                        backgroundColor: "#A1A1AA",
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent sideOffset={6}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-white/60">
                                        Commissions
                                      </span>
                                      <span className="text-xs font-medium text-white/80">
                                        {formatCurrencyValue(commission, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}

                              {swap > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="h-full"
                                      style={{
                                        width: `${swapPct}%`,
                                        backgroundColor: "#6B7280",
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent sideOffset={6}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-white/60">
                                        Swap
                                      </span>
                                      <span className="text-xs font-medium text-white/80">
                                        {formatCurrencyValue(swap, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {commission > 0 ? (
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="size-2 rounded-sm"
                                    style={{ backgroundColor: "#A1A1AA" }}
                                  />
                                  <span className="text-white/55">
                                    Commissions
                                  </span>
                                </div>
                                <span className="font-medium text-white/80">
                                  {formatCurrencyValue(commission, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            ) : null}

                            {swap > 0 ? (
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="size-2 rounded-sm"
                                    style={{ backgroundColor: "#6B7280" }}
                                  />
                                  <span className="text-white/55">Swap</span>
                                </div>
                                <span className="font-medium text-white/80">
                                  {formatCurrencyValue(swap, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-[10px] text-white/30 text-right">
                          Costs = {costPct.toFixed(1)}% of gross P&L
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Compliance Status */}
              {selectedTrade.complianceStatus &&
                selectedTrade.complianceStatus !== "unknown" && (
                  <>
                    <Separator />
                    <div className="px-6 py-3">
                      <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                        Rule compliance
                      </h3>
                    </div>
                    <Separator />
                    <div className="px-6 py-5 space-y-3">
                      <div
                        className={cn(
                          TRADE_SURFACE_CARD_CLASS,
                          getComplianceTone(selectedTrade.complianceStatus),
                          "px-3 py-2 flex items-center gap-2 text-sm font-medium"
                        )}
                      >
                        {selectedTrade.complianceStatus === "pass"
                          ? "✓ All rules passed"
                          : "✗ Rule violations detected"}
                      </div>
                      {selectedTrade.complianceFlags &&
                        selectedTrade.complianceFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTrade.complianceFlags.map((flag, i) => (
                              <span
                                key={i}
                                className={cn(
                                  TRADE_IDENTIFIER_PILL_CLASS,
                                  TRADE_IDENTIFIER_TONES.negative,
                                  "min-h-6 px-2 py-0.5 text-[10px]"
                                )}
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  </>
                )}

              {/* Tags & Classification */}
              {(selectedTrade.sessionTag ||
                selectedTrade.modelTag ||
                selectedTrade.protocolAlignment) && (
                <>
                  <Separator />
                  <div className="px-6 py-3">
                    <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                      Tags
                    </h3>
                  </div>
                  <Separator />
                  <div className="px-6 py-5 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {selectedTrade.sessionTag && (
                        <span
                          style={
                            selectedTrade.sessionTagColor
                              ? getTradeIdentifierColorStyle(
                                  selectedTrade.sessionTagColor
                                )
                              : undefined
                          }
                          className={cn(
                            TRADE_IDENTIFIER_PILL_CLASS,
                            !selectedTrade.sessionTagColor &&
                              TRADE_IDENTIFIER_TONES.neutral
                          )}
                        >
                          Session: {selectedTrade.sessionTag}
                        </span>
                      )}
                      {selectedTrade.modelTag && (
                        <span
                          style={
                            selectedTrade.modelTagColor
                              ? getTradeIdentifierColorStyle(
                                  selectedTrade.modelTagColor
                                )
                              : undefined
                          }
                          className={cn(
                            TRADE_IDENTIFIER_PILL_CLASS,
                            !selectedTrade.modelTagColor &&
                              TRADE_IDENTIFIER_TONES.neutral
                          )}
                        >
                          Model: {selectedTrade.modelTag}
                        </span>
                      )}
                      {selectedTrade.protocolAlignment && (
                        <span
                          className={cn(
                            TRADE_IDENTIFIER_PILL_CLASS,
                            getTradeProtocolTone(
                              selectedTrade.protocolAlignment
                            )
                          )}
                        >
                          {selectedTrade.protocolAlignment === "aligned"
                            ? "✓ Aligned"
                            : selectedTrade.protocolAlignment === "against"
                            ? "✗ Against"
                            : "◆ Discretionary"}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              {(selectedTrade.openText || selectedTrade.closeText) && (
                <>
                  <Separator />
                  <div className="px-6 py-3">
                    <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                      Notes
                    </h3>
                  </div>
                  <Separator />
                  <div className="px-6 py-5 space-y-3">
                    {selectedTrade.openText && (
                      <div className="text-sm">
                        <span className="text-white/50">Entry: </span>
                        <span className="text-white/80">
                          {selectedTrade.openText}
                        </span>
                      </div>
                    )}
                    {selectedTrade.closeText && (
                      <div className="text-sm">
                        <span className="text-white/50">Exit: </span>
                        <span className="text-white/80">
                          {selectedTrade.closeText}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Rich Notes & Annotations */}
              <div className="px-6 py-5">
                <TradeNotesEditor tradeId={selectedTrade.id} />
              </div>

              <Separator />

              {/* Emotion Tagging */}

              <div className="px-6 py-5">
                <EmotionTagger
                  tradeId={selectedTrade.id}
                  accountId={accountId || null}
                />
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="px-6 py-3">
                <h3 className="text-xs font-semibold text-white/70 tracking-wide">
                  Timestamps
                </h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Opened</span>
                    <span className="font-medium">
                      {new Date(selectedTrade.open).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Closed</span>
                    <span className="font-medium">
                      {new Date(selectedTrade.close).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Created</span>
                    <span className="font-medium">
                      {new Date(selectedTrade.createdAtISO).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* View Management Dialog */}
      <ViewManagementDialog
        open={manageViewsOpen}
        onOpenChange={setManageViewsOpen}
      />
    </div>
  );
}
