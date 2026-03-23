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
  const searchDocumentByTradeId = React.useMemo(() => {
    if (searchQueryTokens.length === 0) {
      return null;
    }

    return new Map(
      baseRows.map((row) => [row.id, buildTradeSearchDocument(row)])
    );
  }, [baseRows, searchQueryTokens.length]);

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

  const filteredArtifacts = React.useMemo(() => {
    const emptyArtifacts = {
      commissionsHistogram: [] as number[],
      displayRows: [] as TradeRow[],
      efficiencyHistogram: [] as number[],
      holdHistogram: [] as Array<TradeRow["holdSeconds"]>,
      maeHistogram: [] as number[],
      mfeHistogram: [] as number[],
      profitHistogram: [] as Array<TradeRow["profit"]>,
      rrHistogram: [] as number[],
      swapHistogram: [] as number[],
      symbolCounts: {} as Record<string, number>,
      symbolTotal: 0,
      volumeHistogram: [] as Array<TradeRow["volume"]>,
    };

    if (hasMergedFilterConflict) {
      return emptyArtifacts;
    }

    const commissionsHistogram: number[] = [];
    const displayRows: TradeRow[] = [];
    const efficiencyHistogram: number[] = [];
    const holdHistogram: Array<TradeRow["holdSeconds"]> = [];
    const maeHistogram: number[] = [];
    const mfeHistogram: number[] = [];
    const profitHistogram: Array<TradeRow["profit"]> = [];
    const rrHistogram: number[] = [];
    const swapHistogram: number[] = [];
    const symbolCounts: Record<string, number> = {};
    let symbolTotal = 0;
    const volumeHistogram: Array<TradeRow["volume"]> = [];

    for (const row of baseRows) {
      const matchesIds = idsSet.size === 0 || idsSet.has(row.id);
      const matchesDirection =
        effectiveTradeDirection === "all" ||
        row.tradeDirection === effectiveTradeDirection;
      const matchesSymbols =
        symbolSet.size === 0 ||
        row.isLive !== true ||
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
      const rowOutcome = row.isLive ? "Live" : row.outcome || "";
      const matchesOutcome =
        outcomeSet.size === 0 || outcomeSet.has(rowOutcome as any);
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

      const matchesStaticFilters =
        matchesIds &&
        matchesDirection &&
        matchesKillzone &&
        matchesSessionTag &&
        matchesModelTag &&
        matchesProtocol &&
        matchesOutcome &&
        matchesDate &&
        matchesSearch;
      const matchesNumericFilters =
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
        matchesEfficiency;

      if (matchesStaticFilters && matchesSymbols && matchesNumericFilters) {
        displayRows.push(row);
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
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
      ) {
        holdHistogram.push(row.holdSeconds);
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
        matchesHold &&
        matchesProfit &&
        matchesCommissions &&
        matchesSwap &&
        matchesSl &&
        matchesTp &&
        matchesRr &&
        matchesMfe &&
        matchesMae &&
        matchesEfficiency
      ) {
        volumeHistogram.push(row.volume);
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
        matchesHold &&
        matchesVolume &&
        matchesCommissions &&
        matchesSwap &&
        matchesSl &&
        matchesTp &&
        matchesRr &&
        matchesMfe &&
        matchesMae &&
        matchesEfficiency
      ) {
        profitHistogram.push(row.profit);
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
        matchesHold &&
        matchesVolume &&
        matchesProfit &&
        matchesSwap &&
        matchesSl &&
        matchesTp &&
        matchesRr &&
        matchesMfe &&
        matchesMae &&
        matchesEfficiency
      ) {
        commissionsHistogram.push(Number(row.commissions || 0));
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
        matchesHold &&
        matchesVolume &&
        matchesProfit &&
        matchesCommissions &&
        matchesSl &&
        matchesTp &&
        matchesRr &&
        matchesMfe &&
        matchesMae &&
        matchesEfficiency
      ) {
        swapHistogram.push(Number(row.swap || 0));
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
        matchesHold &&
        matchesVolume &&
        matchesProfit &&
        matchesCommissions &&
        matchesSwap &&
        matchesSl &&
        matchesTp &&
        matchesMfe &&
        matchesMae &&
        matchesEfficiency &&
        isFiniteNumber(row.realisedRR)
      ) {
        rrHistogram.push(row.realisedRR);
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
        matchesHold &&
        matchesVolume &&
        matchesProfit &&
        matchesCommissions &&
        matchesSwap &&
        matchesSl &&
        matchesTp &&
        matchesRr &&
        matchesMae &&
        matchesEfficiency &&
        isFiniteNumber(row.mfePips)
      ) {
        mfeHistogram.push(row.mfePips);
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
        matchesHold &&
        matchesVolume &&
        matchesProfit &&
        matchesCommissions &&
        matchesSwap &&
        matchesSl &&
        matchesTp &&
        matchesRr &&
        matchesMfe &&
        matchesEfficiency &&
        isFiniteNumber(row.maePips)
      ) {
        maeHistogram.push(row.maePips);
      }

      if (
        matchesStaticFilters &&
        matchesSymbols &&
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
        isFiniteNumber(row.rrCaptureEfficiency)
      ) {
        efficiencyHistogram.push(row.rrCaptureEfficiency);
      }

      if (matchesStaticFilters && matchesNumericFilters) {
        symbolCounts[row.symbol] = (symbolCounts[row.symbol] || 0) + 1;
        symbolTotal += 1;
      }
    }

    return {
      commissionsHistogram,
      displayRows,
      efficiencyHistogram,
      holdHistogram,
      maeHistogram,
      mfeHistogram,
      profitHistogram,
      rrHistogram,
      swapHistogram,
      symbolCounts,
      symbolTotal,
      volumeHistogram,
    };
  }, [
    baseRows,
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
  ]);

  const displayRows = filteredArtifacts.displayRows;
  const streakByTradeId = React.useMemo(
    () => buildTradeStreakMap(displayRows),
    [displayRows]
  );

  return {
    commissionsHistogram: filteredArtifacts.commissionsHistogram,
    displayRows,
    efficiencyHistogram: filteredArtifacts.efficiencyHistogram,
    holdHistogram: filteredArtifacts.holdHistogram,
    maeHistogram: filteredArtifacts.maeHistogram,
    mfeHistogram: filteredArtifacts.mfeHistogram,
    profitHistogram: filteredArtifacts.profitHistogram,
    rrHistogram: filteredArtifacts.rrHistogram,
    streakByTradeId,
    swapHistogram: filteredArtifacts.swapHistogram,
    symbolCounts: filteredArtifacts.symbolCounts,
    symbolTotal: filteredArtifacts.symbolTotal,
    volumeHistogram: filteredArtifacts.volumeHistogram,
  };
}
