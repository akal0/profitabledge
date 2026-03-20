import { desc, eq } from "drizzle-orm";

import { db } from "../../db";
import { openTrade } from "../../db/schema/trading";
import { getTradeOriginLabel, type TradeOriginType } from "./trust";

type PublicProofLiveTradeFilters = {
  accountId: string;
  q?: string;
  originTypes?: TradeOriginType[];
  statuses?: Array<"live" | "closed">;
};

type PublicProofLiveTradeRow = {
  id: string;
  symbol: string | null;
  tradeType: string | null;
  volume: number | null;
  openPrice: number | null;
  closePrice: number | null;
  profit: number | null;
  commissions: number | null;
  swap: number | null;
  rr: number | null;
  outcome: string | null;
  openTime: Date;
  closeTime: null;
  createdAt: Date;
  sortAt: Date;
  durationSeconds: number;
  originType: TradeOriginType;
  originLabel: string;
  edited: boolean;
  isLive: true;
};

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesLiveTradeSearch(
  row: PublicProofLiveTradeRow,
  searchTerm?: string
) {
  if (!searchTerm) return true;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return true;

  return [
    row.symbol,
    row.tradeType,
    row.originLabel,
    "live",
    "open",
    "broker sync",
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
}

export async function listPublicProofLiveTrades(
  input: PublicProofLiveTradeFilters
) {
  if (input.statuses?.length === 1 && input.statuses[0] === "closed") {
    return [] satisfies PublicProofLiveTradeRow[];
  }

  if (input.originTypes?.length && !input.originTypes.includes("broker_sync")) {
    return [] satisfies PublicProofLiveTradeRow[];
  }

  const rows = await db
    .select({
      id: openTrade.id,
      symbol: openTrade.symbol,
      tradeType: openTrade.tradeType,
      volume: openTrade.volume,
      openPrice: openTrade.openPrice,
      currentPrice: openTrade.currentPrice,
      profit: openTrade.profit,
      commission: openTrade.commission,
      swap: openTrade.swap,
      openTime: openTrade.openTime,
      createdAt: openTrade.createdAt,
    })
    .from(openTrade)
    .where(eq(openTrade.accountId, input.accountId))
    .orderBy(desc(openTrade.openTime));

  const originType = "broker_sync" satisfies TradeOriginType;
  const originLabel = getTradeOriginLabel(originType);
  const now = Date.now();

  return rows
    .map<PublicProofLiveTradeRow>((row) => {
      const openMs = row.openTime.getTime();
      const rawProfit = row.profit != null ? parseNumber(row.profit) : null;
      const swap = row.swap != null ? parseNumber(row.swap) : null;
      return {
        id: row.id,
        symbol: row.symbol,
        tradeType: row.tradeType,
        volume: row.volume != null ? parseNumber(row.volume) : null,
        openPrice: row.openPrice != null ? parseNumber(row.openPrice) : null,
        closePrice:
          row.currentPrice != null ? parseNumber(row.currentPrice) : null,
        profit: rawProfit != null ? rawProfit + (swap ?? 0) : null,
        commissions:
          row.commission != null ? parseNumber(row.commission) : null,
        swap,
        rr: null,
        outcome: null,
        openTime: row.openTime,
        closeTime: null,
        createdAt: row.createdAt,
        sortAt: row.openTime,
        durationSeconds: Math.max(0, Math.floor((now - openMs) / 1000)),
        originType,
        originLabel,
        edited: false,
        isLive: true as const,
      };
    })
    .filter((row) => matchesLiveTradeSearch(row, input.q));
}
