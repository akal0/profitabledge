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
  const sizing = { ...DEFAULT_COLUMN_SIZES } as Record<string, number>;

  tradeTableColumns.forEach((column: any, index: number) => {
    const columnId = column.id || column.accessorKey || `col_${index}`;
    if (typeof column.size === "number") {
      sizing[columnId] = column.size;
    }
  });

  return sizing;
}
