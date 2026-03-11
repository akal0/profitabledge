interface MtCompletenessCheckpointLike {
  lastFullReconcileAt?: Date | null;
  lastDealTime?: Date | null;
  lastOrderTime?: Date | null;
}

interface MtCompletenessDealLike {
  remoteDealId: string;
  remoteOrderId: string | null;
  positionId: string | null;
  entryType: string | null;
  side: string | null;
  eventTime: Date;
}

interface MtCompletenessOrderLike {
  remoteOrderId: string;
  positionId: string | null;
  side: string | null;
  eventTime: Date;
}

interface MtCompletenessOpenTradeLike {
  ticket: string;
  tradeType: string | null;
}

export interface MtConnectionCompleteness {
  openPositionsMissingEntryDeals: number;
  closeOrdersWithoutExitDeals: number;
  lastFullReconcileAt: string | null;
  lastDealTime: string | null;
  lastOrderTime: string | null;
  historyGapDetected: boolean;
  forceFullReconcile: boolean;
}

export function buildMtConnectionCompleteness(input: {
  checkpoint: MtCompletenessCheckpointLike | null;
  deals: MtCompletenessDealLike[];
  orders: MtCompletenessOrderLike[];
  openTrades: MtCompletenessOpenTradeLike[];
  now?: Date;
  forceReconcileCooldownMs?: number;
}): MtConnectionCompleteness {
  const now = input.now ?? new Date();
  const forceReconcileCooldownMs =
    input.forceReconcileCooldownMs ?? 5 * 60 * 1000;

  const entryDealKeys = new Set(
    input.deals
      .filter((row) => row.entryType === "in" || row.entryType === "inout")
      .map((row) => row.positionId || row.remoteOrderId || row.remoteDealId)
  );
  const exitDealKeys = new Set(
    input.deals
      .filter(
        (row) =>
          row.entryType === "out" ||
          row.entryType === "out_by" ||
          row.entryType === "inout"
      )
      .map((row) => row.positionId || row.remoteOrderId || row.remoteDealId)
  );
  const dealSideByKey = new Map<string, "long" | "short">();
  for (const row of input.deals) {
    const tradeKey = row.positionId || row.remoteOrderId || row.remoteDealId;
    if (!tradeKey || dealSideByKey.has(tradeKey) || !row.side) {
      continue;
    }

    dealSideByKey.set(tradeKey, row.side === "buy" ? "long" : "short");
  }

  const openTradeSideByKey = new Map(
    input.openTrades.map((row) => [row.ticket, row.tradeType])
  );
  const latestDealTsByKey = new Map<string, number>();
  for (const row of input.deals) {
    const tradeKey = row.positionId || row.remoteOrderId || row.remoteDealId;
    if (!tradeKey) {
      continue;
    }

    latestDealTsByKey.set(
      tradeKey,
      Math.max(latestDealTsByKey.get(tradeKey) ?? 0, row.eventTime.getTime())
    );
  }

  const ordersByTradeKey = new Map<string, MtCompletenessOrderLike[]>();
  for (const row of input.orders) {
    const tradeKey = row.positionId || row.remoteOrderId;
    if (!tradeKey) {
      continue;
    }

    const bucket = ordersByTradeKey.get(tradeKey) ?? [];
    bucket.push(row);
    ordersByTradeKey.set(tradeKey, bucket);
  }

  let closeOrdersWithoutExitDeals = 0;
  for (const [tradeKey, tradeOrders] of ordersByTradeKey.entries()) {
    if (exitDealKeys.has(tradeKey)) {
      continue;
    }

    const tradeSide =
      openTradeSideByKey.get(tradeKey) ?? dealSideByKey.get(tradeKey) ?? null;
    if (!tradeSide) {
      continue;
    }

    const latestDealTs = latestDealTsByKey.get(tradeKey) ?? 0;
    const hasLikelyCloseOrder = tradeOrders.some((row) => {
      if (!row.side) {
        return false;
      }

      const isOppositeSide =
        (tradeSide === "long" && row.side === "sell") ||
        (tradeSide === "short" && row.side === "buy");
      return isOppositeSide && row.eventTime.getTime() >= latestDealTs;
    });

    if (hasLikelyCloseOrder) {
      closeOrdersWithoutExitDeals += 1;
    }
  }

  const openPositionsMissingEntryDeals = input.openTrades.filter(
    (row) => !entryDealKeys.has(row.ticket)
  ).length;
  const lastFullReconcileAt =
    input.checkpoint?.lastFullReconcileAt?.toISOString() ?? null;
  const lastDealTime = input.checkpoint?.lastDealTime?.toISOString() ?? null;
  const lastOrderTime = input.checkpoint?.lastOrderTime?.toISOString() ?? null;
  const historyGapDetected =
    openPositionsMissingEntryDeals > 0 || closeOrdersWithoutExitDeals > 0;
  const lastFullReconcileAgeMs =
    input.checkpoint?.lastFullReconcileAt != null
      ? now.getTime() - input.checkpoint.lastFullReconcileAt.getTime()
      : Number.POSITIVE_INFINITY;

  return {
    openPositionsMissingEntryDeals,
    closeOrdersWithoutExitDeals,
    lastFullReconcileAt,
    lastDealTime,
    lastOrderTime,
    historyGapDetected,
    forceFullReconcile:
      historyGapDetected && lastFullReconcileAgeMs >= forceReconcileCooldownMs,
  };
}
