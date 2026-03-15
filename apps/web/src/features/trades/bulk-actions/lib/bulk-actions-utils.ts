"use client";

import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

export function isTradeFavorited(trade: Pick<TradeRow, "closeText">) {
  return (
    typeof trade.closeText === "string" &&
    trade.closeText.includes("[FAVORITE]")
  );
}

export function getBulkFavoriteAction(selectedTrades: TradeRow[] | undefined) {
  const trades = selectedTrades ?? [];
  const allFavorited = trades.length > 0 && trades.every(isTradeFavorited);

  return {
    favorite: !allFavorited,
    label: allFavorited ? "Remove from favorites" : "Add to favorites",
  } as const;
}
