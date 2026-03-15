"use client";

import * as React from "react";

import {
  buildTradeSearchDocument,
  matchesTradeSearch,
  tokenizeTradeSearchQuery,
} from "../lib/trade-table-search";
import {
  buildTradeStreakMap,
  isFiniteNumber,
  type NumericRange,
} from "../lib/trade-table-view-state";
import {
  isTradeWithinDateRange,
  isValueInRange,
} from "../lib/trade-table-query-state";
import type { TradeRow } from "../lib/trade-table-types";

type UseTradeTableFilteredDataArgs = {
  baseRows: TradeRow[];
  ids: string[];
  q: string;
  killzones: string[];
  effectiveTradeDirection: "all" | "long" | "short";
  effectiveSymbols: string[];
  effectiveSessionTags: string[];
  effectiveModelTags: string[];
  effectiveProtocolAlignments: string[];
  effectiveOutcomes: string[];
  mergedDateRange: { start?: Date; end?: Date };
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
  hasMergedFilterConflict: boolean;
};

type ExcludedFilter =
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
  | "eff";

export function useTradeTableFilteredData({
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
  hasMergedFilterConflict,
}: UseTradeTableFilteredDataArgs) {
  const searchQueryTokens = React.useMemo(
    () => tokenizeTradeSearchQuery(q),
    [q]
  );
  const searchDocumentByTradeId = React.useMemo(
    () =>
      new Map(baseRows.map((row) => [row.id, buildTradeSearchDocument(row)])),
    [baseRows]
  );

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
      excluded: Set<ExcludedFilter> = new Set()
    ) => {
      if (hasMergedFilterConflict) return [] as TradeRow[];

      return rowsToFilter.filter((row) => {
        if (!excluded.has("ids") && idsSet.size > 0 && !idsSet.has(row.id)) return false;
        if (
          !excluded.has("direction") &&
          effectiveTradeDirection !== "all" &&
          row.tradeDirection !== effectiveTradeDirection
        ) {
          return false;
        }
        if (!excluded.has("symbols") && symbolSet.size > 0 && !symbolSet.has(row.symbol)) {
          return false;
        }
        if (killzoneSet.size > 0 && !killzoneSet.has(row.killzone || "")) return false;
        if (sessionTagSet.size > 0 && !sessionTagSet.has(row.sessionTag || "")) return false;
        if (modelTagSet.size > 0 && !modelTagSet.has(row.modelTag || "")) return false;
        if (
          protocolSet.size > 0 &&
          !protocolSet.has((row.protocolAlignment || "") as any)
        ) {
          return false;
        }
        const rowOutcome = row.isLive ? "Live" : row.outcome || "";
        if (outcomeSet.size > 0 && !outcomeSet.has(rowOutcome as any)) return false;
        if (
          !excluded.has("date") &&
          !isTradeWithinDateRange(row, mergedDateRange.start, mergedDateRange.end)
        ) {
          return false;
        }
        if (
          searchQueryTokens.length > 0 &&
          !matchesTradeSearch(searchDocumentByTradeId.get(row.id), searchQueryTokens)
        ) {
          return false;
        }
        if (!excluded.has("hold") && !isValueInRange(row.holdSeconds, effectiveHoldRange)) {
          return false;
        }
        if (!excluded.has("vol") && !isValueInRange(row.volume, effectiveVolRange)) {
          return false;
        }
        if (!excluded.has("pl") && !isValueInRange(row.profit, effectivePlRange)) {
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
        if (!excluded.has("sl") && !isValueInRange(row.sl, effectiveSlRange)) return false;
        if (!excluded.has("tp") && !isValueInRange(row.tp, effectiveTpRange)) return false;
        if (!excluded.has("rr") && !isValueInRange(row.realisedRR, effectiveRrRange)) {
          return false;
        }
        if (!excluded.has("mfe") && !isValueInRange(row.mfePips, effectiveMfeRange)) {
          return false;
        }
        if (!excluded.has("mae") && !isValueInRange(row.maePips, effectiveMaeRange)) {
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
      effectivePlRange,
      effectiveRrRange,
      effectiveSlRange,
      effectiveSwapRange,
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
      searchDocumentByTradeId,
      searchQueryTokens,
      sessionTagSet,
      symbolSet,
    ]
  );

  const displayRows = React.useMemo(
    () => applyClientFilters(baseRows),
    [applyClientFilters, baseRows]
  );
  const streakByTradeId = React.useMemo(
    () => buildTradeStreakMap(displayRows),
    [displayRows]
  );
  const holdHistogram = React.useMemo(
    () => applyClientFilters(baseRows, new Set(["hold"])).map((row) => row.holdSeconds),
    [applyClientFilters, baseRows]
  );
  const volumeHistogram = React.useMemo(
    () => applyClientFilters(baseRows, new Set(["vol"])).map((row) => row.volume),
    [applyClientFilters, baseRows]
  );
  const profitHistogram = React.useMemo(
    () => applyClientFilters(baseRows, new Set(["pl"])).map((row) => row.profit),
    [applyClientFilters, baseRows]
  );
  const commissionsHistogram = React.useMemo(
    () =>
      applyClientFilters(baseRows, new Set(["com"])).map((row) => Number(row.commissions || 0)),
    [applyClientFilters, baseRows]
  );
  const swapHistogram = React.useMemo(
    () => applyClientFilters(baseRows, new Set(["swap"])).map((row) => Number(row.swap || 0)),
    [applyClientFilters, baseRows]
  );
  const rrHistogram = React.useMemo(
    () =>
      applyClientFilters(baseRows, new Set(["rr"]))
        .map((row) => row.realisedRR)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );
  const mfeHistogram = React.useMemo(
    () =>
      applyClientFilters(baseRows, new Set(["mfe"]))
        .map((row) => row.mfePips)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );
  const maeHistogram = React.useMemo(
    () =>
      applyClientFilters(baseRows, new Set(["mae"]))
        .map((row) => row.maePips)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );
  const efficiencyHistogram = React.useMemo(
    () =>
      applyClientFilters(baseRows, new Set(["eff"]))
        .map((row) => row.rrCaptureEfficiency)
        .filter(isFiniteNumber),
    [applyClientFilters, baseRows]
  );
  const rowsForSymbolPreview = React.useMemo(
    () => applyClientFilters(baseRows, new Set(["symbols"])),
    [applyClientFilters, baseRows]
  );
  const symbolCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rowsForSymbolPreview) {
      counts[row.symbol] = (counts[row.symbol] || 0) + 1;
    }
    return counts;
  }, [rowsForSymbolPreview]);

  return {
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
    symbolTotal: rowsForSymbolPreview.length,
    volumeHistogram,
  };
}
