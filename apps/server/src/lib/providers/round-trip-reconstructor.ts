import type { NormalizedTrade } from "./types";

export interface ExecutionFillSeed {
  id: string;
  groupKey: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price: number;
  time: Date;
  profit?: number | null;
  commission?: number | null;
  swap?: number | null;
  comment?: string | null;
  raw: Record<string, unknown>;
}

type OpenLot = {
  remainingVolume: number;
};

type CycleState = {
  groupKey: string;
  symbol: string;
  direction: "buy" | "sell";
  openTime: Date;
  closeTime: Date | null;
  entryVolume: number;
  entryNotional: number;
  exitVolume: number;
  exitNotional: number;
  profit: number;
  hasExplicitProfit: boolean;
  commission: number;
  hasCommission: boolean;
  swap: number;
  hasSwap: boolean;
  comment: string | null;
  openFillIds: string[];
  closeFillIds: string[];
  openLots: OpenLot[];
  rawFills: Record<string, unknown>[];
};

function allocate(value: number | null | undefined, ratio: number): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  return value * ratio;
}

function createCycle(fill: ExecutionFillSeed, volume: number, ratio: number): CycleState {
  return {
    groupKey: fill.groupKey,
    symbol: fill.symbol,
    direction: fill.side,
    openTime: fill.time,
    closeTime: null,
    entryVolume: volume,
    entryNotional: fill.price * volume,
    exitVolume: 0,
    exitNotional: 0,
    profit: 0,
    hasExplicitProfit: false,
    commission: allocate(fill.commission, ratio),
    hasCommission: fill.commission != null,
    swap: allocate(fill.swap, ratio),
    hasSwap: fill.swap != null,
    comment: fill.comment ?? null,
    openFillIds: [fill.id],
    closeFillIds: [],
    openLots: [{ remainingVolume: volume }],
    rawFills: [fill.raw],
  };
}

function appendOpeningFill(
  cycle: CycleState,
  fill: ExecutionFillSeed,
  volume: number,
  ratio: number
) {
  cycle.entryVolume += volume;
  cycle.entryNotional += fill.price * volume;
  cycle.commission += allocate(fill.commission, ratio);
  cycle.swap += allocate(fill.swap, ratio);
  cycle.hasCommission ||= fill.commission != null;
  cycle.hasSwap ||= fill.swap != null;
  cycle.openLots.push({ remainingVolume: volume });
  cycle.rawFills.push(fill.raw);
  cycle.comment ??= fill.comment ?? null;

  if (!cycle.openFillIds.includes(fill.id)) {
    cycle.openFillIds.push(fill.id);
  }
}

function appendClosingFill(
  cycle: CycleState,
  fill: ExecutionFillSeed,
  volume: number,
  ratio: number
) {
  cycle.exitVolume += volume;
  cycle.exitNotional += fill.price * volume;
  cycle.profit += allocate(fill.profit, ratio);
  cycle.commission += allocate(fill.commission, ratio);
  cycle.swap += allocate(fill.swap, ratio);
  cycle.hasExplicitProfit ||= fill.profit != null;
  cycle.hasCommission ||= fill.commission != null;
  cycle.hasSwap ||= fill.swap != null;
  cycle.closeTime = fill.time;
  cycle.rawFills.push(fill.raw);
  cycle.comment ??= fill.comment ?? null;

  if (!cycle.closeFillIds.includes(fill.id)) {
    cycle.closeFillIds.push(fill.id);
  }
}

function consumeOpenLots(cycle: CycleState, volume: number) {
  let remaining = volume;

  while (remaining > 0 && cycle.openLots.length > 0) {
    const lot = cycle.openLots[0]!;
    const consumed = Math.min(lot.remainingVolume, remaining);
    lot.remainingVolume -= consumed;
    remaining -= consumed;

    if (lot.remainingVolume <= 0) {
      cycle.openLots.shift();
    }
  }
}

function finalizeCycle(cycle: CycleState): NormalizedTrade | null {
  if (
    cycle.entryVolume <= 0 ||
    cycle.exitVolume <= 0 ||
    !cycle.closeTime
  ) {
    return null;
  }

  const openPrice = cycle.entryNotional / cycle.entryVolume;
  const closePrice = cycle.exitNotional / cycle.exitVolume;
  const tradeType = cycle.direction === "buy" ? "long" : "short";
  const inferredProfit =
    tradeType === "long"
      ? (closePrice - openPrice) * cycle.exitVolume
      : (openPrice - closePrice) * cycle.exitVolume;

  return {
    ticket: `${cycle.groupKey}:${cycle.openFillIds[0] ?? "open"}:${cycle.closeFillIds.at(-1) ?? "close"}`,
    symbol: cycle.symbol,
    tradeType,
    volume: cycle.exitVolume,
    openPrice,
    closePrice,
    openTime: cycle.openTime,
    closeTime: cycle.closeTime,
    profit: cycle.hasExplicitProfit ? cycle.profit : inferredProfit,
    sl: null,
    tp: null,
    swap: cycle.hasSwap ? cycle.swap : null,
    commissions: cycle.hasCommission ? cycle.commission : null,
    pips: null,
    comment: cycle.comment,
    _raw: {
      groupKey: cycle.groupKey,
      openFillIds: cycle.openFillIds,
      closeFillIds: cycle.closeFillIds,
      fillCount: cycle.rawFills.length,
      fills: cycle.rawFills,
    },
  };
}

export function reconstructRoundTripsFromFills(
  fills: ExecutionFillSeed[]
): NormalizedTrade[] {
  const grouped = new Map<string, ExecutionFillSeed[]>();

  for (const fill of fills) {
    if (
      !fill.groupKey ||
      !fill.symbol ||
      fill.volume <= 0 ||
      !Number.isFinite(fill.price) ||
      Number.isNaN(fill.time.getTime())
    ) {
      continue;
    }

    const bucket = grouped.get(fill.groupKey) ?? [];
    bucket.push(fill);
    grouped.set(fill.groupKey, bucket);
  }

  const trades: NormalizedTrade[] = [];

  for (const group of grouped.values()) {
    group.sort((left, right) => {
      const timeDiff = left.time.getTime() - right.time.getTime();
      return timeDiff !== 0 ? timeDiff : left.id.localeCompare(right.id);
    });

    let cycle: CycleState | null = null;

    for (const fill of group) {
      const totalVolume = fill.volume;
      let remainingVolume = totalVolume;

      while (remainingVolume > 0) {
        if (!cycle) {
          cycle = createCycle(fill, remainingVolume, remainingVolume / totalVolume);
          break;
        }

        if (fill.side === cycle.direction) {
          appendOpeningFill(
            cycle,
            fill,
            remainingVolume,
            remainingVolume / totalVolume
          );
          break;
        }

        const openVolume = cycle.openLots.reduce(
          (sum, lot) => sum + lot.remainingVolume,
          0
        );
        if (openVolume <= 0) {
          cycle = null;
          continue;
        }

        const matchedVolume = Math.min(openVolume, remainingVolume);
        appendClosingFill(
          cycle,
          fill,
          matchedVolume,
          matchedVolume / totalVolume
        );
        consumeOpenLots(cycle, matchedVolume);
        remainingVolume -= matchedVolume;

        if (cycle.openLots.length === 0) {
          const completedTrade = finalizeCycle(cycle);
          if (completedTrade) {
            trades.push(completedTrade);
          }
          cycle = null;
        }
      }
    }
  }

  return trades.sort(
    (left, right) => left.closeTime.getTime() - right.closeTime.getTime()
  );
}
