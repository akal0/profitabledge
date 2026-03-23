import { DEFAULT_COLUMN_SIZES } from "@/hooks/use-column-resizing";

import { tradeTableColumns } from "./trade-table-columns";

const CORE_COLUMNS = new Set([
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

const TRADE_TABLE_COLUMN_SIZES: Record<string, number> = {
  select: 32,
  symbol: 108,
  tradeDirection: 110,
  sessionTag: 128,
  modelTag: 128,
  customTags: 190,
  protocolAlignment: 110,
  outcome: 92,
  complianceStatus: 108,
  streak: 92,
  tp: 110,
  sl: 110,
  open: 128,
  close: 128,
  holdSeconds: 112,
  volume: 88,
  profit: 120,
  commissions: 112,
  swap: 92,
  manipulationPips: 152,
  mfePips: 166,
  maePips: 166,
  entrySpreadPips: 142,
  exitSpreadPips: 138,
  entrySlippagePips: 152,
  exitSlippagePips: 146,
  slModCount: 160,
  tpModCount: 166,
  partialCloseCount: 122,
  exitDealCount: 104,
  exitVolume: 110,
  entryBalance: 122,
  entryEquity: 116,
  entryMargin: 118,
  entryFreeMargin: 138,
  entryMarginLevel: 132,
  entryDealCount: 108,
  entryVolume: 112,
  scaleInCount: 102,
  scaleOutCount: 108,
  trailingStopDetected: 120,
  entryPeakDurationSeconds: 112,
  postExitPeakDurationSeconds: 118,
  mpeManipLegR: 190,
  mpeManipPE_R: 194,
  maxRR: 140,
  realisedRR: 138,
  rrCaptureEfficiency: 194,
  manipRREfficiency: 208,
  rawSTDV: 132,
  rawSTDV_PE: 164,
  stdvBucket: 126,
  estimatedWeightedMPE_R: 212,
  plannedRR: 144,
  plannedRiskPips: 148,
  plannedTargetPips: 156,
  exitEfficiency: 126,
  drawdown: 132,
};

export function buildTradeTableColumnVisibility(
  viewParam?: string | null,
  selectedViewVisibleColumns?: string[] | null
) {
  if (!viewParam) {
    const visibility: Record<string, boolean> = {};
    tradeTableColumns.forEach((column: any) => {
      const columnId = column.accessorKey || column.id;
      if (columnId) visibility[columnId] = true;
    });
    return visibility;
  }

  if (selectedViewVisibleColumns?.length) {
    const visibleSet = new Set(selectedViewVisibleColumns);
    const visibility: Record<string, boolean> = {};

    tradeTableColumns.forEach((column: any) => {
      const columnId = column.accessorKey || column.id;
      if (columnId) {
        visibility[columnId] = visibleSet.has(columnId);
      }
    });

    return visibility;
  }

  const visibility: Record<string, boolean> = {};
  tradeTableColumns.forEach((column: any) => {
    const columnId = column.accessorKey || column.id;
    if (!columnId) return;
    visibility[columnId] = CORE_COLUMNS.has(columnId);
  });
  return visibility;
}

export function buildTradeTableInitialSizing() {
  const sizing = {
    ...DEFAULT_COLUMN_SIZES,
    ...TRADE_TABLE_COLUMN_SIZES,
  } as Record<string, number>;

  tradeTableColumns.forEach((column: any, index: number) => {
    const columnId = column.id || column.accessorKey || `col_${index}`;
    if (typeof column.size === "number") {
      sizing[columnId] = column.size;
    }
  });

  return sizing;
}
