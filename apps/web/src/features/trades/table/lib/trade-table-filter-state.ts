import {
  mergeArrayFilter,
  mergeDirectionFilter,
  mergeNumericRange,
  type DirectionType,
  type OutcomeFilterValue,
  type SelectedTradeViewConfig,
  type TradeViewFilters,
} from "./trade-table-view-state";
import {
  mergeDateRange,
  normalizeLegacyIntegerUpperBoundRange,
  parseRangeParam,
} from "./trade-table-query-state";

export type TradeTableStatFilters = {
  rrMin?: number;
  rrMax?: number;
  mfeMin?: number;
  mfeMax?: number;
  maeMin?: number;
  maeMax?: number;
  efficiencyMin?: number;
  efficiencyMax?: number;
};

type TradeTableFilterStateInput = {
  idsParam: string;
  slParam: string;
  tpParam: string;
  dirParam: string;
  symbolsParam: string;
  killzonesParam: string;
  sessionTagsParam: string;
  modelTagsParam: string;
  protocolParam: string;
  outcomeParam: string;
  holdParam: string;
  volParam: string;
  plParam: string;
  comParam: string;
  swapParam: string;
  rrParam: string;
  mfeParam: string;
  maeParam: string;
  effParam: string;
  oStart: string;
  oEnd: string;
  selectedViewConfig?: SelectedTradeViewConfig;
};

const parseCsvParam = (param: string) =>
  param ? param.split(",").filter(Boolean) : [];

const parseDirectionParam = (param: string): DirectionType =>
  param === "long" || param === "short" || param === "all"
    ? param
    : "all";

export const deriveTradeTableFilterState = ({
  idsParam,
  slParam,
  tpParam,
  dirParam,
  symbolsParam,
  killzonesParam,
  sessionTagsParam,
  modelTagsParam,
  protocolParam,
  outcomeParam,
  holdParam,
  volParam,
  plParam,
  comParam,
  swapParam,
  rrParam,
  mfeParam,
  maeParam,
  effParam,
  oStart,
  oEnd,
  selectedViewConfig,
}: TradeTableFilterStateInput) => {
  const ids = parseCsvParam(idsParam);
  const tradeDirection = parseDirectionParam(dirParam);
  const symbols = parseCsvParam(symbolsParam);
  const killzones = parseCsvParam(killzonesParam);
  const sessionTags = parseCsvParam(sessionTagsParam);
  const modelTags = parseCsvParam(modelTagsParam);
  const protocolAlignments = parseCsvParam(protocolParam);
  const outcomes = parseCsvParam(outcomeParam) as OutcomeFilterValue[];

  const start = oStart ? new Date(oStart) : undefined;
  const end = oEnd ? new Date(oEnd) : undefined;

  const holdRange = parseRangeParam(holdParam);
  const volRange = parseRangeParam(volParam);
  const rawPlRange = parseRangeParam(plParam);
  const plRange = normalizeLegacyIntegerUpperBoundRange(plParam, rawPlRange);
  const rawComRange = parseRangeParam(comParam);
  const comRange = normalizeLegacyIntegerUpperBoundRange(comParam, rawComRange);
  const rawSwapRange = parseRangeParam(swapParam);
  const swapRange = normalizeLegacyIntegerUpperBoundRange(
    swapParam,
    rawSwapRange
  );
  const rrRange = parseRangeParam(rrParam);
  const mfeRange = parseRangeParam(mfeParam);
  const maeRange = parseRangeParam(maeParam);
  const efficiencyRange = parseRangeParam(effParam);
  const slRange = parseRangeParam(slParam);
  const tpRange = parseRangeParam(tpParam);

  const viewFilters: TradeViewFilters = selectedViewConfig?.filters || {};
  const numericFiltersFromView = viewFilters.numericFilters || {};

  const mergedDateRange = mergeDateRange(start, end, viewFilters.dateRange);
  const mergedDirection = mergeDirectionFilter(
    tradeDirection,
    viewFilters.directions,
    viewFilters.tradeDirection
  );
  const mergedSymbols = mergeArrayFilter(symbols, viewFilters.symbols);
  const mergedSessionTags = mergeArrayFilter(
    sessionTags,
    viewFilters.sessionTags
  );
  const mergedModelTags = mergeArrayFilter(modelTags, viewFilters.modelTags);
  const mergedProtocol = mergeArrayFilter(
    protocolAlignments,
    viewFilters.protocolAlignment
  );
  const mergedOutcomes = mergeArrayFilter(outcomes, viewFilters.outcomes);

  const mergedHoldRange = mergeNumericRange(
    holdRange,
    numericFiltersFromView.holdSeconds
  );
  const mergedVolRange = mergeNumericRange(
    volRange,
    numericFiltersFromView.volume
  );
  const mergedPlRange = mergeNumericRange(
    plRange,
    numericFiltersFromView.profit
  );
  const mergedComRange = mergeNumericRange(
    comRange,
    numericFiltersFromView.commissions
  );
  const mergedSwapRange = mergeNumericRange(
    swapRange,
    numericFiltersFromView.swap
  );
  const mergedSlRange = mergeNumericRange(slRange, numericFiltersFromView.sl);
  const mergedTpRange = mergeNumericRange(tpRange, numericFiltersFromView.tp);
  const mergedRrRange = mergeNumericRange(
    rrRange,
    numericFiltersFromView.realisedRR
  );
  const mergedMfeRange = mergeNumericRange(
    mfeRange,
    numericFiltersFromView.mfePips
  );
  const mergedMaeRange = mergeNumericRange(
    maeRange,
    numericFiltersFromView.maePips
  );
  const mergedEfficiencyRange = mergeNumericRange(
    efficiencyRange,
    numericFiltersFromView.rrCaptureEfficiency
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
  const effectiveClosedOutcomes = effectiveOutcomes.filter(
    (outcome): outcome is Exclude<OutcomeFilterValue, "Live"> =>
      outcome !== "Live"
  );
  const onlyLiveOutcomeSelected =
    effectiveOutcomes.length > 0 && effectiveClosedOutcomes.length === 0;

  return {
    ids,
    tradeDirection,
    symbols,
    killzones,
    sessionTags,
    modelTags,
    protocolAlignments,
    outcomes,
    start,
    end,
    holdRange,
    volRange,
    rawPlRange,
    plRange,
    rawComRange,
    comRange,
    rawSwapRange,
    swapRange,
    rrRange,
    mfeRange,
    maeRange,
    efficiencyRange,
    slRange,
    tpRange,
    viewFilters,
    mergedDateRange,
    hasMergedFilterConflict,
    effectiveTradeDirection,
    effectiveSymbols,
    effectiveSessionTags,
    effectiveModelTags,
    effectiveProtocolAlignments,
    effectiveOutcomes,
    effectiveClosedOutcomes,
    onlyLiveOutcomeSelected,
    effectiveHoldRange: mergedHoldRange.range,
    effectiveVolRange: mergedVolRange.range,
    effectivePlRange: mergedPlRange.range,
    effectiveComRange: mergedComRange.range,
    effectiveSwapRange: mergedSwapRange.range,
    effectiveSlRange: mergedSlRange.range,
    effectiveTpRange: mergedTpRange.range,
    effectiveRrRange: mergedRrRange.range,
    effectiveMfeRange: mergedMfeRange.range,
    effectiveMaeRange: mergedMaeRange.range,
    effectiveEfficiencyRange: mergedEfficiencyRange.range,
    statFilterSeed: {
      rrMin: rrRange?.[0],
      rrMax: rrRange?.[1],
      mfeMin: mfeRange?.[0],
      mfeMax: mfeRange?.[1],
      maeMin: maeRange?.[0],
      maeMax: maeRange?.[1],
      efficiencyMin: efficiencyRange?.[0],
      efficiencyMax: efficiencyRange?.[1],
    } satisfies TradeTableStatFilters,
  };
};
