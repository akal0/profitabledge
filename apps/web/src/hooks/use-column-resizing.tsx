import * as React from "react";
import type { Column } from "@tanstack/react-table";

interface ColumnSizing {
  [key: string]: number;
}

interface UseColumnResizingProps {
  tableId: string;
  defaultSizing?: ColumnSizing;
  onSave?: (sizing: ColumnSizing) => Promise<void>;
}

const STORAGE_KEY_PREFIX = "table-column-sizing-";
const DEBOUNCE_MS = 500;

export function useColumnResizing({
  tableId,
  defaultSizing = {},
  onSave,
}: UseColumnResizingProps) {
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizing>(() => {
    // Try to load from localStorage first
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tableId}`);
      if (stored) {
        return { ...defaultSizing, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error("Failed to load column sizing:", error);
    }
    return defaultSizing;
  });

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Debounced save to localStorage and server
  const saveColumnSizing = React.useCallback(
    (sizing: ColumnSizing) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // Save to localStorage
          localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${tableId}`,
            JSON.stringify(sizing)
          );

          // Save to server if callback provided
          if (onSave) {
            await onSave(sizing);
          }
        } catch (error) {
          console.error("Failed to save column sizing:", error);
        }
      }, DEBOUNCE_MS);
    },
    [tableId, onSave]
  );

  const handleColumnSizingChange = React.useCallback(
    (updater: ColumnSizing | ((old: ColumnSizing) => ColumnSizing)) => {
      setColumnSizing((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveColumnSizing(next);
        return next;
      });
    },
    [saveColumnSizing]
  );

  const resetColumnSizing = React.useCallback(() => {
    setColumnSizing(defaultSizing);
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tableId}`);
    } catch (error) {
      console.error("Failed to reset column sizing:", error);
    }
  }, [tableId, defaultSizing]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    columnSizing,
    onColumnSizingChange: handleColumnSizingChange,
    resetColumnSizing,
  };
}

// Helper to create resize handle component
export function ResizeHandle({ column }: { column: Column<any, unknown> }) {
  const resizeHandler = (column as any).getResizeHandler?.();
  const resizingDelta = (column as any).getResizingDelta?.() ?? 0;
  const isDragging = column.getIsResizing();

  return (
    <div
      onMouseDown={resizeHandler}
      onTouchStart={resizeHandler}
      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none
        ${isDragging ? "bg-teal-500" : "hover:bg-white/20"}
        transition-colors`}
      style={{
        transform: isDragging ? `translateX(${resizingDelta}px)` : "",
      }}
    />
  );
}

// Default column sizes (in pixels)
export const DEFAULT_COLUMN_SIZES: Record<string, number> = {
  select: 40,
  symbol: 120,
  tradeDirection: 80,
  open: 140,
  close: 140,
  holdSeconds: 100,
  volume: 80,
  profit: 100,
  commissions: 90,
  swap: 80,
  entryPrice: 100,
  closePrice: 100,
  sl: 100,
  tp: 100,
  pips: 80,
  realisedRR: 90,
  maxRR: 90,
  rrCaptureEfficiency: 110,
  exitEfficiency: 110,
  mfePips: 80,
  maePips: 80,
  sessionTag: 120,
  modelTag: 120,
  protocolAlignment: 120,
  outcome: 80,
  plannedRR: 90,
  plannedRiskPips: 100,
  plannedTargetPips: 100,
  manipulationPips: 110,
  entrySpreadPips: 100,
  exitSpreadPips: 100,
  stdvBucket: 100,
};

// Get minimum column size
export function getMinColumnSize(columnId: string): number {
  const minimums: Record<string, number> = {
    select: 40,
    symbol: 80,
    tradeDirection: 60,
  };
  return minimums[columnId] || 60;
}

// Get maximum column size
export function getMaxColumnSize(columnId: string): number {
  return 500; // Max 500px for any column
}
