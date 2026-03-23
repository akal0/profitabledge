"use client";

import {
  ALL_OUTCOME_FILTER_VALUES,
  OUTCOME_FILTER_LABELS,
  type AppliedFilter,
  type StatFilters,
} from "./trades-toolbar-types";

export function getHistogramBounds(
  values: number[] | undefined,
  options: {
    minFloor?: number;
    maxFloor?: number;
    fallbackMin?: number;
    fallbackMax?: number;
  } = {}
) {
  const { minFloor, maxFloor, fallbackMin = 0, fallbackMax = 1 } = options;
  const finiteValues = (values || []).filter((value) => Number.isFinite(value));
  let minValue = finiteValues.length ? Math.min(...finiteValues) : fallbackMin;
  let maxValue = finiteValues.length ? Math.max(...finiteValues) : fallbackMax;

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
}

export function formatTriggerLabel(label: string, count?: number) {
  return count && count > 0 ? `${label} (${count})` : label;
}

export function formatHuman(date: Date) {
  const day = date.getDate();
  const j = day % 10;
  const k = day % 100;
  const suffix =
    j === 1 && k !== 11
      ? "st"
      : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day}${suffix} ${month}' ${year}`;
}

export function formatDuration(totalSec: number) {
  const seconds = Math.max(0, Math.floor(totalSec || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${remainder}s`);
  return parts.join(" ");
}

export function formatHoldBadge(
  minSec?: number,
  maxSec?: number,
  histogram?: number[]
) {
  if (typeof minSec !== "number" || typeof maxSec !== "number") return "";
  const hasHistogram = Array.isArray(histogram) && histogram.length > 0;
  const minBound = hasHistogram ? Math.min(...histogram) : 0;
  const maxBound = hasHistogram ? Math.max(...histogram) : Math.max(maxSec, 0);
  const slack = 60;
  const atLower = minSec <= minBound + slack;
  const atUpper = maxSec >= maxBound - slack;

  if (atLower && atUpper) return "Hold time: All times";
  if (atLower && !atUpper) return `Hold time: <= ${formatDuration(maxSec)}`;
  if (!atLower && atUpper) return `Hold time: >= ${formatDuration(minSec)}`;
  return `Hold time: ${formatDuration(minSec)} - ${formatDuration(maxSec)}`;
}

export function formatNumeric(value: number, prefix?: string) {
  const abs = Math.abs(value).toLocaleString();
  const sign = value < 0 ? "-" : "";
  return `${sign}${prefix || ""}${abs}`;
}

export function formatNumBadge(
  label: string,
  minVal?: number,
  maxVal?: number,
  histogram?: number[],
  prefix?: string
) {
  if (typeof minVal !== "number" || typeof maxVal !== "number") return "";
  const hasHistogram = Array.isArray(histogram) && histogram.length > 0;
  const minBound = hasHistogram ? Math.min(...histogram) : minVal;
  const maxBound = hasHistogram ? Math.max(...histogram) : maxVal;
  const slack = Math.max(1, Math.round((maxBound - minBound) * 0.01));
  const atLower = minVal <= minBound + slack;
  const atUpper = maxVal >= maxBound - slack;

  if (atLower && atUpper) return `${label}: All`;
  if (atLower && !atUpper) return `${label}: <= ${formatNumeric(maxVal, prefix)}`;
  if (!atLower && atUpper) return `${label}: >= ${formatNumeric(minVal, prefix)}`;
  return `${label}: ${formatNumeric(minVal, prefix)} - ${formatNumeric(maxVal, prefix)}`;
}

export function getSortBadge(sortValue?: string) {
  if (!sortValue || sortValue === "open:desc") return "";
  const labels: Record<string, string> = {
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
  if (labels[sortValue]) return labels[sortValue];

  const [id, dir] = sortValue.split(":");
  const name =
    id === "open"
      ? "opens"
      : id === "close"
        ? "closes"
        : id === "profit"
          ? "profit and loss"
          : id === "volume"
            ? "volume"
            : id === "holdSeconds"
              ? "holds"
              : id === "commissions"
                ? "fees"
                : id === "swap"
                  ? "swap"
                  : id;
  return dir === "asc" ? `Lowest ${name} first` : `Highest ${name} first`;
}

type BuildAppliedFiltersArgs = {
  start?: Date;
  end?: Date;
  onClearDate: () => void;
  tradeDirection?: "all" | "long" | "short";
  onClearDirection: () => void;
  holdMin?: number;
  holdMax?: number;
  holdHistogram?: number[];
  onClearHold: () => void;
  volumeMin?: number;
  volumeMax?: number;
  volumeHistogram?: number[];
  onClearVolume: () => void;
  profitMin?: number;
  profitMax?: number;
  profitHistogram?: number[];
  onClearProfit: () => void;
  commissionsMin?: number;
  commissionsMax?: number;
  commissionsHistogram?: number[];
  onClearCommissions: () => void;
  swapMin?: number;
  swapMax?: number;
  swapHistogram?: number[];
  onClearSwap: () => void;
  killzones: string[];
  allKillzonesLength: number;
  onClearKillzones: () => void;
  sessionTags: string[];
  allSessionTagsLength: number;
  onClearSessionTags: () => void;
  modelTags: string[];
  allModelTagsLength: number;
  onClearModelTags: () => void;
  protocolAlignments: string[];
  onClearProtocol: () => void;
  outcomes: string[];
  onClearOutcomes: () => void;
  symbols: string[];
  allSymbolsLength: number;
  onClearSymbols: () => void;
  statFilters: StatFilters;
  onClearRr: () => void;
  onClearMfe: () => void;
  onClearMae: () => void;
  onClearEfficiency: () => void;
};

export function buildAppliedFilters({
  start,
  end,
  onClearDate,
  tradeDirection,
  onClearDirection,
  holdMin,
  holdMax,
  holdHistogram,
  onClearHold,
  volumeMin,
  volumeMax,
  volumeHistogram,
  onClearVolume,
  profitMin,
  profitMax,
  profitHistogram,
  onClearProfit,
  commissionsMin,
  commissionsMax,
  commissionsHistogram,
  onClearCommissions,
  swapMin,
  swapMax,
  swapHistogram,
  onClearSwap,
  killzones,
  allKillzonesLength,
  onClearKillzones,
  sessionTags,
  allSessionTagsLength,
  onClearSessionTags,
  modelTags,
  allModelTagsLength,
  onClearModelTags,
  protocolAlignments,
  onClearProtocol,
  outcomes,
  onClearOutcomes,
  symbols,
  allSymbolsLength,
  onClearSymbols,
  statFilters,
  onClearRr,
  onClearMfe,
  onClearMae,
  onClearEfficiency,
}: BuildAppliedFiltersArgs): AppliedFilter[] {
  const filters: Array<AppliedFilter | null> = [
    start && end
      ? {
          key: "date",
          label: `Date: ${formatHuman(start)} - ${formatHuman(end)}`,
          onClear: onClearDate,
        }
      : null,
    (tradeDirection ?? "all") !== "all"
      ? {
          key: "direction",
          label: `Direction: ${tradeDirection === "long" ? "Longs only" : "Shorts only"}`,
          onClear: onClearDirection,
        }
      : null,
    typeof holdMin === "number" && typeof holdMax === "number"
      ? {
          key: "hold",
          label: formatHoldBadge(holdMin, holdMax, holdHistogram),
          onClear: onClearHold,
        }
      : null,
    typeof volumeMin === "number" && typeof volumeMax === "number"
      ? {
          key: "volume",
          label: formatNumBadge("Volume", volumeMin, volumeMax, volumeHistogram),
          onClear: onClearVolume,
        }
      : null,
    typeof profitMin === "number" && typeof profitMax === "number"
      ? {
          key: "profit",
          label: formatNumBadge(
            "Profit and loss",
            profitMin,
            profitMax,
            profitHistogram,
            "$"
          ),
          onClear: onClearProfit,
        }
      : null,
    typeof commissionsMin === "number" && typeof commissionsMax === "number"
      ? {
          key: "commissions",
          label: formatNumBadge(
            "Commissions",
            commissionsMin,
            commissionsMax,
            commissionsHistogram,
            "$"
          ),
          onClear: onClearCommissions,
        }
      : null,
    typeof swapMin === "number" && typeof swapMax === "number"
      ? {
          key: "swap",
          label: formatNumBadge("Swap", swapMin, swapMax, swapHistogram, "$"),
          onClear: onClearSwap,
        }
      : null,
    killzones.length > 0 && killzones.length !== allKillzonesLength
      ? {
          key: "killzones",
          label: `Killzones: ${killzones.slice(0, 2).join(", ")}${
            killzones.length > 2 ? ` +${killzones.length - 2}` : ""
          }`,
          onClear: onClearKillzones,
        }
      : null,
    sessionTags.length > 0 && sessionTags.length !== allSessionTagsLength
      ? {
          key: "session-tags",
          label: `Session: ${sessionTags.slice(0, 2).join(", ")}${
            sessionTags.length > 2 ? ` +${sessionTags.length - 2}` : ""
          }`,
          onClear: onClearSessionTags,
        }
      : null,
    modelTags.length > 0 && modelTags.length !== allModelTagsLength
      ? {
          key: "model-tags",
          label: `Edge: ${modelTags.slice(0, 2).join(", ")}${
            modelTags.length > 2 ? ` +${modelTags.length - 2}` : ""
          }`,
          onClear: onClearModelTags,
        }
      : null,
    protocolAlignments.length > 0 && protocolAlignments.length !== 3
      ? {
          key: "protocol",
          label: `Protocol: ${protocolAlignments
            .slice(0, 2)
            .map((value) =>
              value === "aligned"
                ? "Aligned"
                : value === "against"
                  ? "Against"
                  : "Discretionary"
            )
            .join(", ")}${protocolAlignments.length > 2 ? ` +${protocolAlignments.length - 2}` : ""}`,
          onClear: onClearProtocol,
        }
      : null,
    outcomes.length > 0 && outcomes.length !== ALL_OUTCOME_FILTER_VALUES.length
      ? {
          key: "outcomes",
          label: `Outcome: ${outcomes
            .slice(0, 2)
            .map((value) => OUTCOME_FILTER_LABELS[value as keyof typeof OUTCOME_FILTER_LABELS] || value)
            .join(", ")}${outcomes.length > 2 ? ` +${outcomes.length - 2}` : ""}`,
          onClear: onClearOutcomes,
        }
      : null,
    symbols.length > 0 && symbols.length !== allSymbolsLength
      ? {
          key: "symbols",
          label: `Symbols: ${symbols.slice(0, 3).join(", ")}${
            symbols.length > 3 ? ` +${symbols.length - 3}` : ""
          }`,
          onClear: onClearSymbols,
        }
      : null,
    statFilters.rrMin != null || statFilters.rrMax != null
      ? {
          key: "rr",
          label: formatNumBadge("Realised RR", statFilters.rrMin, statFilters.rrMax),
          onClear: onClearRr,
        }
      : null,
    statFilters.mfeMin != null || statFilters.mfeMax != null
      ? {
          key: "mfe",
          label: formatNumBadge("MFE", statFilters.mfeMin, statFilters.mfeMax),
          onClear: onClearMfe,
        }
      : null,
    statFilters.maeMin != null || statFilters.maeMax != null
      ? {
          key: "mae",
          label: formatNumBadge("MAE", statFilters.maeMin, statFilters.maeMax),
          onClear: onClearMae,
        }
      : null,
    statFilters.efficiencyMin != null || statFilters.efficiencyMax != null
      ? {
          key: "efficiency",
          label:
            statFilters.efficiencyMin == null
              ? `RR efficiency: <= ${statFilters.efficiencyMax}%`
              : statFilters.efficiencyMax == null
                ? `RR efficiency: >= ${statFilters.efficiencyMin}%`
                : `RR efficiency: ${statFilters.efficiencyMin}% - ${statFilters.efficiencyMax}%`,
          onClear: onClearEfficiency,
        }
      : null,
  ];

  return filters.filter(Boolean) as AppliedFilter[];
}
