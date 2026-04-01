"use client";

import * as React from "react";

import type { StatFilters, TagFilterOption } from "./trades-toolbar-types";

export type TradeFiltersContextValue = {
  allKillzones?: TagFilterOption[];
  allModelTags?: TagFilterOption[];
  allSessionTags?: TagFilterOption[];
  allSymbols?: string[];
  commissionsHistogram?: number[];
  commissionsMax?: number;
  commissionsMin?: number;
  efficiencyHistogram?: number[];
  end?: Date;
  holdHistogram?: number[];
  holdMax?: number;
  holdMin?: number;
  killzones: string[];
  maeHistogram?: number[];
  maxBound?: Date;
  mfeHistogram?: number[];
  minBound?: Date;
  modelTags: string[];
  onCommissionsClear?: () => void;
  onCommissionsCommit?: (min: number, max: number) => void;
  onDirectionChange: (direction: "all" | "long" | "short") => void;
  onHoldClear?: () => void;
  onHoldCommit?: (min: number, max: number) => void;
  onKillzonesChange: (killzones: string[]) => void;
  onMaeClear?: () => void;
  onMfeClear?: () => void;
  onModelTagsChange: (modelTags: string[]) => void;
  onOutcomesChange: (outcomes: string[]) => void;
  onProfitClear?: () => void;
  onProfitCommit?: (min: number, max: number) => void;
  onProtocolAlignmentsChange: (protocolAlignments: string[]) => void;
  onQChange: (q: string) => void;
  onRangeChange: (start?: Date, end?: Date) => void;
  onSessionTagsChange: (sessionTags: string[]) => void;
  onStatFiltersApply?: (filters?: StatFilters) => void;
  onStatFiltersChange?: (filters: StatFilters) => void;
  onSwapClear?: () => void;
  onSwapCommit?: (min: number, max: number) => void;
  onSymbolsChange: (symbols: string[]) => void;
  onVolumeClear?: () => void;
  onVolumeCommit?: (min: number, max: number) => void;
  outcomes: string[];
  profitHistogram?: number[];
  profitMax?: number;
  profitMin?: number;
  protocolAlignments: string[];
  q: string;
  rrHistogram?: number[];
  sessionTags: string[];
  sortValue?: string;
  start?: Date;
  statFilters?: StatFilters;
  swapHistogram?: number[];
  swapMax?: number;
  swapMin?: number;
  symbolCounts?: Record<string, number>;
  symbolTotal?: number;
  symbols: string[];
  tradeDirection?: "all" | "long" | "short";
  volumeHistogram?: number[];
  volumeMax?: number;
  volumeMin?: number;
};

const TradeFiltersContext = React.createContext<TradeFiltersContextValue | null>(
  null
);

export function TradeFiltersProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: TradeFiltersContextValue;
}) {
  return (
    <TradeFiltersContext.Provider value={value}>
      {children}
    </TradeFiltersContext.Provider>
  );
}

export function useTradeFiltersContext() {
  const context = React.useContext(TradeFiltersContext);

  if (!context) {
    throw new Error("useTradeFiltersContext must be used within TradeFiltersProvider");
  }

  return context;
}
