"use client";

import * as React from "react";

import {
  buildTradeSearchDocument,
  matchesTradeSearch,
  tokenizeTradeSearchQuery,
} from "../lib/trade-table-search";
import {
  buildTradeStreakMap,
  type NumericRange,
  type TradeFilterArtifacts,
} from "../lib/trade-table-view-state";
import {
  isTradeWithinDateRange,
  isValueInRange,
} from "../lib/trade-table-query-state";
import type { TradeRow } from "../lib/trade-table-types";

type UseTradeTableFilteredDataArgs = {
  closedRows: TradeRow[];
  liveRows: TradeRow[];
  filterArtifacts: TradeFilterArtifacts;
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

const EMPTY_FILTER_ARTIFACTS: TradeFilterArtifacts = {
  commissionsHistogram: [],
  efficiencyHistogram: [],
  holdHistogram: [],
  maeHistogram: [],
  mfeHistogram: [],
  profitHistogram: [],
  rrHistogram: [],
  swapHistogram: [],
  symbolCounts: {},
  symbolTotal: 0,
  volumeHistogram: [],
};

export function useTradeTableFilteredData({
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
  const searchDocumentByTradeId = React.useMemo(() => {
    if (searchQueryTokens.length === 0 || liveRows.length === 0) {
      return null;
    }

    return new Map(
      liveRows.map((row) => [row.id, buildTradeSearchDocument(row)])
    );
  }, [liveRows, searchQueryTokens.length]);

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

  const filteredLiveRows = React.useMemo(() => {
    if (hasMergedFilterConflict) {
      return [] as TradeRow[];
    }

    return liveRows.filter((row) => {
      const matchesIds = idsSet.size === 0 || idsSet.has(row.id);
      const matchesDirection =
        effectiveTradeDirection === "all" ||
        row.tradeDirection === effectiveTradeDirection;
      const matchesSymbols =
        symbolSet.size === 0 ||
        [row.rawSymbol, row.symbol, row.symbolGroup]
          .filter((value): value is string => Boolean(value))
          .some((value) => symbolSet.has(value));
      const matchesKillzone =
        killzoneSet.size === 0 || killzoneSet.has(row.killzone || "");
      const matchesSessionTag =
        sessionTagSet.size === 0 || sessionTagSet.has(row.sessionTag || "");
      const matchesModelTag =
        modelTagSet.size === 0 || modelTagSet.has(row.modelTag || "");
      const matchesProtocol =
        protocolSet.size === 0 ||
        protocolSet.has((row.protocolAlignment || "") as any);
      const matchesOutcome =
        outcomeSet.size === 0 || outcomeSet.has("Live" as any);
      const matchesDate = isTradeWithinDateRange(
        row,
        mergedDateRange.start,
        mergedDateRange.end
      );
      const matchesSearch =
        searchQueryTokens.length === 0 ||
        matchesTradeSearch(
          searchDocumentByTradeId?.get(row.id),
          searchQueryTokens
        );
      const matchesHold = isValueInRange(row.holdSeconds, effectiveHoldRange);
      const matchesVolume = isValueInRange(row.volume, effectiveVolRange);
      const matchesProfit = isValueInRange(row.profit, effectivePlRange);
      const matchesCommissions = isValueInRange(
        Number(row.commissions || 0),
        effectiveComRange
      );
      const matchesSwap = isValueInRange(
        Number(row.swap || 0),
        effectiveSwapRange
      );
      const matchesSl = isValueInRange(row.sl, effectiveSlRange);
      const matchesTp = isValueInRange(row.tp, effectiveTpRange);
      const matchesRr = isValueInRange(row.realisedRR, effectiveRrRange);
      const matchesMfe = isValueInRange(row.mfePips, effectiveMfeRange);
      const matchesMae = isValueInRange(row.maePips, effectiveMaeRange);
      const matchesEfficiency = isValueInRange(
        row.rrCaptureEfficiency,
        effectiveEfficiencyRange
      );

      return (
        matchesIds &&
        matchesDirection &&
        matchesSymbols &&
        matchesKillzone &&
        matchesSessionTag &&
        matchesModelTag &&
        matchesProtocol &&
        matchesOutcome &&
        matchesDate &&
        matchesSearch &&
        matchesHold &&
        matchesVolume &&
        matchesProfit &&
        matchesCommissions &&
        matchesSwap &&
        matchesSl &&
        matchesTp &&
        matchesRr &&
        matchesMfe &&
        matchesMae &&
        matchesEfficiency
      );
    });
  }, [
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
    liveRows,
    mergedDateRange.end,
    mergedDateRange.start,
    modelTagSet,
    outcomeSet,
    protocolSet,
    searchDocumentByTradeId,
    searchQueryTokens,
    sessionTagSet,
    symbolSet,
  ]);

  const displayRows = React.useMemo(
    () => [...filteredLiveRows, ...closedRows],
    [closedRows, filteredLiveRows]
  );
  const streakByTradeId = React.useMemo(
    () => buildTradeStreakMap(displayRows),
    [displayRows]
  );

  return {
    ...(hasMergedFilterConflict ? EMPTY_FILTER_ARTIFACTS : filterArtifacts),
    displayRows,
    streakByTradeId,
  };
}
