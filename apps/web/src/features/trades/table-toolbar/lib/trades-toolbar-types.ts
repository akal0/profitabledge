"use client";

import type { Table } from "@tanstack/react-table";
import type { TradeTableGroupBy } from "@/features/trades/table/lib/trade-table-grouping";
import type { TradePnlDisplayMode } from "@/features/trades/table/lib/trade-table-types";

export type OutcomeFilterValue = "Win" | "Loss" | "BE" | "PW" | "Live";

export const ALL_OUTCOME_FILTER_VALUES: OutcomeFilterValue[] = [
  "Win",
  "Loss",
  "BE",
  "PW",
  "Live",
];

export const OUTCOME_FILTER_LABELS: Record<OutcomeFilterValue, string> = {
  Win: "Win",
  Loss: "Loss",
  BE: "Break-even",
  PW: "Partial win",
  Live: "Live",
};

export type TagFilterOption = {
  name: string;
  color: string;
};

export type StatFilters = {
  rrMin?: number;
  rrMax?: number;
  mfeMin?: number;
  mfeMax?: number;
  maeMin?: number;
  maeMax?: number;
  efficiencyMin?: number;
  efficiencyMax?: number;
};

export type AppliedFilter = {
  key: string;
  label: string;
  onClear: () => void;
};

export interface TradesToolbarProps {
  q: string;
  table: Table<any>;
  tableId?: string;
  onQChange: (q: string) => void;
  tradeDirection?: "all" | "long" | "short";
  onDirectionChange: (direction: "all" | "long" | "short") => void;
  symbols: string[];
  onSymbolsChange: (symbols: string[]) => void;
  allSymbols?: string[];
  symbolCounts?: Record<string, number>;
  symbolTotal?: number;
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
  sortValue?: string;
  onSortChange?: (sortValue: string) => void;
  onClearSort?: () => void;
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
  pnlMode?: TradePnlDisplayMode;
  onPnlModeChange?: (mode: TradePnlDisplayMode) => void;
  baselineInitialBalance?: number | string | null;
  ddMode?: "pips" | "percent" | "usd";
  onDdModeChange?: (mode: "pips" | "percent" | "usd") => void;
  selectedViewId?: string | null;
  onViewChange?: (viewId: string | null) => void;
  onManageViews?: () => void;
  accountId?: string | null;
  statFilters?: StatFilters;
  onStatFiltersChange?: (filters: StatFilters) => void;
  onStatFiltersApply?: (filters?: StatFilters) => void;
  groupBy?: TradeTableGroupBy | null;
  onGroupByChange?: (groupBy: TradeTableGroupBy | null) => void;
}
