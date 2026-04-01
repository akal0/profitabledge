"use client";

import { ViewManagementDialog } from "@/components/view-management-dialog";
import { TradeComparisonSheet } from "@/components/trades/trade-comparison-sheet";
import { TradeDetailSheet } from "@/features/trades/table/components/trade-detail-sheet";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

type TradeTableSheetsProps = {
  accountId: string | null;
  compareOpen: boolean;
  manageViewsOpen: boolean;
  onCompareOpenChange: (open: boolean) => void;
  onManageViewsOpenChange: (open: boolean) => void;
  onTradeDetailOpenChange: (open: boolean) => void;
  selectedTrade: TradeRow | null;
  selectedTrades: TradeRow[];
  tradeDetailOpen: boolean;
};

export function TradeTableSheets({
  accountId,
  compareOpen,
  manageViewsOpen,
  onCompareOpenChange,
  onManageViewsOpenChange,
  onTradeDetailOpenChange,
  selectedTrade,
  selectedTrades,
  tradeDetailOpen,
}: TradeTableSheetsProps) {
  return (
    <>
      <TradeComparisonSheet
        open={compareOpen}
        onOpenChange={onCompareOpenChange}
        trades={selectedTrades}
      />
      <TradeDetailSheet
        accountId={accountId}
        open={tradeDetailOpen}
        onOpenChange={onTradeDetailOpenChange}
        selectedTrade={selectedTrade}
      />
      <ViewManagementDialog
        open={manageViewsOpen}
        onOpenChange={onManageViewsOpenChange}
      />
    </>
  );
}
