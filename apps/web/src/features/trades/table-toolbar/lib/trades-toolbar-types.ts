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
  table: Table<any>;
  tableId?: string;
  sortValue?: string;
  onSortChange?: (sortValue: string) => void;
  onClearSort?: () => void;
  pnlMode?: TradePnlDisplayMode;
  onPnlModeChange?: (mode: TradePnlDisplayMode) => void;
  baselineInitialBalance?: number | string | null;
  ddMode?: "pips" | "percent" | "usd";
  onDdModeChange?: (mode: "pips" | "percent" | "usd") => void;
  selectedViewId?: string | null;
  onViewChange?: (viewId: string | null) => void;
  onManageViews?: () => void;
  accountId?: string | null;
  groupBy?: TradeTableGroupBy | null;
  onGroupByChange?: (groupBy: TradeTableGroupBy | null) => void;
}
