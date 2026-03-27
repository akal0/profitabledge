"use client";

export function normalizeTradeIds(tradeIds: string[]) {
  return Array.from(new Set(tradeIds.map((tradeId) => tradeId.trim()).filter(Boolean)));
}

export function buildTradesRouteHref(tradeIds: string[]) {
  const normalizedTradeIds = normalizeTradeIds(tradeIds);
  const idsQuery = normalizedTradeIds.join(",");
  return idsQuery ? `/dashboard/trades?ids=${idsQuery}` : "/dashboard/trades";
}

export function viewTrades(tradeIds: string[], onViewTrades?: (tradeIds: string[]) => void) {
  const normalizedTradeIds = normalizeTradeIds(tradeIds);

  if (normalizedTradeIds.length === 0) {
    return;
  }

  if (onViewTrades) {
    onViewTrades(normalizedTradeIds);
    return;
  }

  if (typeof window !== "undefined") {
    window.location.assign(buildTradesRouteHref(normalizedTradeIds));
  }
}
