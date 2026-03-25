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
  select: 36,
  symbol: 124,
  tradeDirection: 128,
  sessionTag: 164,
  modelTag: 188,
  customTags: 240,
  protocolAlignment: 156,
  outcome: 112,
  complianceStatus: 124,
  streak: 92,
  tp: 118,
  sl: 118,
  open: 152,
  close: 152,
  holdSeconds: 122,
  volume: 96,
  profit: 132,
  commissions: 120,
  swap: 100,
  manipulationPips: 168,
  mfePips: 176,
  maePips: 176,
  entrySpreadPips: 160,
  exitSpreadPips: 160,
  entrySlippagePips: 172,
  exitSlippagePips: 172,
  slModCount: 176,
  tpModCount: 182,
  partialCloseCount: 144,
  exitDealCount: 118,
  exitVolume: 124,
  entryBalance: 140,
  entryEquity: 136,
  entryMargin: 138,
  entryFreeMargin: 156,
  entryMarginLevel: 148,
  entryDealCount: 120,
  entryVolume: 124,
  scaleInCount: 116,
  scaleOutCount: 122,
  trailingStopDetected: 136,
  entryPeakDurationSeconds: 128,
  postExitPeakDurationSeconds: 136,
  mpeManipLegR: 210,
  mpeManipPE_R: 214,
  maxRR: 150,
  realisedRR: 148,
  rrCaptureEfficiency: 210,
  manipRREfficiency: 224,
  rawSTDV: 146,
  rawSTDV_PE: 178,
  stdvBucket: 152,
  estimatedWeightedMPE_R: 228,
  plannedRR: 156,
  plannedRiskPips: 160,
  plannedTargetPips: 168,
  exitEfficiency: 144,
  drawdown: 144,
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
