"use client";

import type { TradeTableGroupBy } from "@/features/trades/table/lib/trade-table-grouping";

export type TradeTableViewMode = "table" | "list";

export type TradeTableOrchestrationState = {
  compareOpen: boolean;
  detailOpen: boolean;
  focusedTradeId: string | null;
  groupBy: TradeTableGroupBy | null;
  manageViewsOpen: boolean;
  selectedTradeId: string | null;
  viewMode: TradeTableViewMode;
};

export type TradeTableOrchestrationAction =
  | { type: "openTrade"; tradeId: string }
  | { type: "setCompareOpen"; open: boolean }
  | { type: "setDetailOpen"; open: boolean }
  | { type: "setFocusedTradeId"; tradeId: string | null }
  | { type: "setGroupBy"; groupBy: TradeTableGroupBy | null }
  | { type: "setManageViewsOpen"; open: boolean }
  | { type: "setSelectedTradeId"; tradeId: string | null }
  | { type: "setViewMode"; viewMode: TradeTableViewMode }
  | { type: "resetForClear" };

export function createTradeTableOrchestrationState(
  viewMode: TradeTableViewMode
): TradeTableOrchestrationState {
  return {
    compareOpen: false,
    detailOpen: false,
    focusedTradeId: null,
    groupBy: null,
    manageViewsOpen: false,
    selectedTradeId: null,
    viewMode,
  };
}

export function tradeTableOrchestrationReducer(
  state: TradeTableOrchestrationState,
  action: TradeTableOrchestrationAction
): TradeTableOrchestrationState {
  switch (action.type) {
    case "openTrade":
      return {
        ...state,
        compareOpen: false,
        detailOpen: true,
        focusedTradeId: action.tradeId,
        selectedTradeId: action.tradeId,
      };
    case "setCompareOpen":
      return {
        ...state,
        compareOpen: action.open,
      };
    case "setDetailOpen":
      return {
        ...state,
        detailOpen: action.open,
      };
    case "setFocusedTradeId":
      return {
        ...state,
        focusedTradeId: action.tradeId,
      };
    case "setGroupBy":
      return {
        ...state,
        groupBy: action.groupBy,
      };
    case "setManageViewsOpen":
      return {
        ...state,
        manageViewsOpen: action.open,
      };
    case "setSelectedTradeId":
      return {
        ...state,
        selectedTradeId: action.tradeId,
      };
    case "setViewMode":
      return {
        ...state,
        viewMode: action.viewMode,
      };
    case "resetForClear":
      return {
        ...state,
        compareOpen: false,
        detailOpen: false,
        focusedTradeId: null,
        groupBy: null,
        selectedTradeId: null,
      };
    default:
      return state;
  }
}
