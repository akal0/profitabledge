import { protectedProcedure } from "../../lib/trpc";
import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { getHistoricalRates } from "dukascopy-node";

import { db } from "../../db";
import { trade } from "../../db/schema/trading";
import {
  getContractSizeForSymbol,
  getPipSizeForSymbol,
  mapToDukascopyInstrument,
} from "../../lib/dukascopy";
import {
  resolveTradeDrawdown,
  resolveTradeDrawdowns,
  type TradeDrawdownSourceRow,
} from "../../lib/trades/drawdown";
import { parseNaiveAsUTC } from "./shared";

const tradeDrawdownSelect = {
  id: trade.id,
  accountId: trade.accountId,
  useBrokerData: trade.useBrokerData,
  createdAt: trade.createdAt,
  openRaw: sql<string | null>`(${trade.open})`,
  closeRaw: sql<string | null>`(${trade.close})`,
  symbol: trade.symbol,
  tradeType: trade.tradeType,
  volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
  openPrice: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
  sl: sql<number | null>`CAST(${trade.sl} AS NUMERIC)`,
  tp: sql<number | null>`CAST(${trade.tp} AS NUMERIC)`,
  durationSecRaw: sql<string | null>`(${trade.tradeDurationSeconds})`,
  closePrice: sql<number | null>`CAST(${trade.closePrice} AS NUMERIC)`,
  profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
  commissions: sql<number | null>`CAST(${trade.commissions} AS NUMERIC)`,
  swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
  manipulationHigh: sql<
    number | null
  >`CAST(${trade.manipulationHigh} AS NUMERIC)`,
  manipulationLow: sql<
    number | null
  >`CAST(${trade.manipulationLow} AS NUMERIC)`,
  manipulationPips: sql<
    number | null
  >`CAST(${trade.manipulationPips} AS NUMERIC)`,
} as const;

async function getTradeDrawdownRows(tradeIds: string[]) {
  return db
    .select(tradeDrawdownSelect)
    .from(trade)
    .where(inArray(trade.id, tradeIds));
}

export const tradeDrawdownProcedures = {
  drawdownForTrade: protectedProcedure
    .input(z.object({ id: z.string().min(1), debug: z.boolean().optional() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .select({
            id: trade.id,
            accountId: trade.accountId,
            useBrokerData: trade.useBrokerData,
            createdAt: trade.createdAt,
            openRaw: sql<string | null>`(${trade.open})`,
            closeRaw: sql<string | null>`(${trade.close})`,
            symbol: trade.symbol,
            tradeType: trade.tradeType,
            volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
            openPrice: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
            sl: sql<number | null>`CAST(${trade.sl} AS NUMERIC)`,
            tp: sql<number | null>`CAST(${trade.tp} AS NUMERIC)`,
            durationSecRaw: sql<string | null>`(${trade.tradeDurationSeconds})`,
            closePrice: sql<
              number | null
            >`CAST(${trade.closePrice} AS NUMERIC)`,
            profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
            commissions: sql<
              number | null
            >`CAST(${trade.commissions} AS NUMERIC)`,
            swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
            manipulationHigh: sql<
              number | null
            >`CAST(${trade.manipulationHigh} AS NUMERIC)`,
            manipulationLow: sql<
              number | null
            >`CAST(${trade.manipulationLow} AS NUMERIC)`,
            manipulationPips: sql<
              number | null
            >`CAST(${trade.manipulationPips} AS NUMERIC)`,
          })
          .from(trade)
          .where(eq(trade.id, input.id))
          .limit(1);

        if (!row.length) return null;
        const currentTrade = row[0];

        const hasManipulationData =
          currentTrade.manipulationHigh != null &&
          currentTrade.manipulationLow != null &&
          currentTrade.manipulationPips != null;

        const symbol = (currentTrade.symbol || "").toUpperCase();
        const entry = Number(currentTrade.openPrice || 0);
        const sl =
          currentTrade.sl != null && Number(currentTrade.sl) > 0
            ? Number(currentTrade.sl)
            : null;
        const tp =
          currentTrade.tp != null && Number(currentTrade.tp) > 0
            ? Number(currentTrade.tp)
            : null;
        const closePx =
          currentTrade.closePrice != null
            ? Number(currentTrade.closePrice)
            : null;
        const direction =
          String(currentTrade.tradeType || "")
            .toLowerCase()
            .includes("short") ||
          String(currentTrade.tradeType || "")
            .toLowerCase()
            .includes("sell")
            ? "short"
            : "long";

        const pipSize = getPipSizeForSymbol(symbol);
        getContractSizeForSymbol(symbol);
        const tolPx = pipSize * 0.5;
        const volume = Number(currentTrade.volume || 1);

        if (!(entry > 0)) {
          return {
            id: currentTrade.id,
            adversePips: null,
            adverseUsd: null,
            pctToSL: null,
            hit: "NONE" as const,
            note: "NO_ENTRY",
            dataSource: "none",
          } as const;
        }

        if (hasManipulationData) {
          const manipHigh = Number(currentTrade.manipulationHigh);
          const manipLow = Number(currentTrade.manipulationLow);

          let adversePips = 0;
          if (direction === "long") {
            adversePips = Math.max(0, entry - manipLow) / pipSize;
          } else {
            adversePips = Math.max(0, manipHigh - entry) / pipSize;
          }

          let closePips = 0;
          if (closePx != null) {
            closePips =
              direction === "long"
                ? (closePx - entry) / pipSize
                : (entry - closePx) / pipSize;
          }

          const profitValue = Number(currentTrade.profit || 0);
          const commissionsValue = Number(currentTrade.commissions || 0);
          const swapValue = Number(currentTrade.swap || 0);
          const netProfitLoss = profitValue + commissionsValue + swapValue;

          const dollarPerPip =
            closePips !== 0 && Math.abs(netProfitLoss) > 0
              ? Math.abs(netProfitLoss / closePips)
              : 10 * volume;

          const adverseUsd = adversePips * dollarPerPip;
          let pctToSL: number | null = null;
          let hit: "SL" | "BE" | "TP" | "CLOSE" = "CLOSE";

          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL =
              distToSlPips > 0
                ? Math.max(0, Math.min(100, (adversePips / distToSlPips) * 100))
                : 0;

            const slHit =
              direction === "long"
                ? manipLow <= sl + tolPx
                : manipHigh >= sl - tolPx;

            if (slHit) {
              const beCandidate =
                (direction === "long" && sl >= entry - tolPx) ||
                (direction === "short" && sl <= entry + tolPx);
              hit = beCandidate ? "BE" : "SL";
              pctToSL = 100;
            }
          }

          return {
            id: currentTrade.id,
            adversePips: Math.round(adversePips * 100) / 100,
            adverseUsd: Math.round(adverseUsd * 100) / 100,
            pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
            hit,
            dataSource: "manipulation",
          };
        }

        const parseDate = (raw: string | null, fallback: Date) =>
          parseNaiveAsUTC(raw) || fallback;

        const openAt = parseDate(currentTrade.openRaw, currentTrade.createdAt);
        let closeAt = parseDate(currentTrade.closeRaw, currentTrade.createdAt);
        const parsedDuration = currentTrade.durationSecRaw
          ? Number(currentTrade.durationSecRaw)
          : Number.NaN;

        if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
          closeAt = new Date(
            openAt.getTime() + Math.floor(parsedDuration) * 1000
          );
        }

        const minTo = new Date(openAt.getTime() + 60_000);
        if (!(closeAt.getTime() > openAt.getTime())) {
          closeAt = minTo;
        }

        const mapped = mapToDukascopyInstrument(symbol);
        const instrument = mapped.instrument || symbol.toLowerCase();
        const side: "bid" | "ask" = direction === "long" ? "bid" : "ask";

        if (sl != null && Number.isFinite(sl) && sl > 0 && closePx != null) {
          const beCandidate =
            (direction === "long" && sl >= entry - tolPx) ||
            (direction === "short" && sl <= entry + tolPx);
          const hitByTolerance =
            (direction === "long" && closePx <= sl + tolPx) ||
            (direction === "short" && closePx >= sl - tolPx);

          if (hitByTolerance) {
            const pipsToSl = Math.abs(sl - entry) / pipSize;
            return {
              id: currentTrade.id,
              adversePips: Math.round(pipsToSl * 100) / 100,
              pctToSL: 100,
              hit: (beCandidate ? "BE" : "SL") as "BE" | "SL",
              dataSource: "dukascopy",
            } as const;
          }
        }

        if (
          currentTrade.profit != null &&
          Number(currentTrade.profit) < 0 &&
          closePx != null
        ) {
          const adversePips = Math.abs(closePx - entry) / pipSize;
          const profitValue = Math.abs(Number(currentTrade.profit));
          const dollarPerPip =
            adversePips > 0 ? profitValue / adversePips : 10 * volume;
          const adverseUsd = adversePips * dollarPerPip;

          let pctToSL: number | null = null;
          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL =
              distToSlPips > 0
                ? Math.max(0, Math.min(100, (adversePips / distToSlPips) * 100))
                : 0;
          }

          return {
            id: currentTrade.id,
            adversePips: Math.round(adversePips * 100) / 100,
            adverseUsd: Math.round(adverseUsd * 100) / 100,
            pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
            hit: "CLOSE" as const,
            dataSource: "dukascopy",
          };
        }

        const dukaConfigBase = {
          instrument,
          format: "json" as const,
          priceType: side,
          volumes: false,
          ignoreFlats: false,
          batchSize: 10,
          pauseBetweenBatchesMs: 1000,
          utcOffset: -120,
        };

        async function fetchM1(from: Date, to: Date) {
          const raw = (await getHistoricalRates({
            ...dukaConfigBase,
            dates: { from, to },
            timeframe: "m1",
          } as any)) as any;
          return Array.isArray(raw) ? raw : [];
        }

        async function fetchTicks(from: Date, to: Date) {
          const raw = (await getHistoricalRates({
            ...dukaConfigBase,
            dates: { from, to },
            timeframe: "tick",
          } as any)) as any;
          return Array.isArray(raw) ? raw : [];
        }

        const floorToMinute = (date: Date) =>
          new Date(Math.floor(date.getTime() / 60_000) * 60_000);
        const ceilToMinute = (date: Date) =>
          new Date(Math.ceil(date.getTime() / 60_000) * 60_000);

        let usedFrom = floorToMinute(openAt);
        let usedTo = ceilToMinute(closeAt);
        let priceData: any[] = await fetchM1(usedFrom, usedTo);

        if (!priceData.length) {
          const padMs = 60 * 1000;
          usedFrom = floorToMinute(new Date(openAt.getTime() - padMs));
          usedTo = ceilToMinute(new Date(closeAt.getTime() + padMs));
          priceData = await fetchM1(usedFrom, usedTo);
        }

        if (!Array.isArray(priceData) || priceData.length === 0) {
          return {
            id: currentTrade.id,
            adversePips: null,
            adverseUsd: null,
            pctToSL: null,
            hit: "NONE" as const,
            note:
              Number(currentTrade.useBrokerData || 0) === 1
                ? "NO_BROKER_PRICE_HISTORY"
                : "NO_PRICE_DATA",
            dataSource:
              Number(currentTrade.useBrokerData || 0) === 1
                ? "broker-history-missing"
                : "dukascopy",
            candleRange: {
              from: usedFrom.toISOString(),
              to: usedTo.toISOString(),
              utcOffset: dukaConfigBase.utcOffset,
            },
            tickRange: null,
          };
        }

        let candleFromMs = Number.POSITIVE_INFINITY;
        let candleToMs = Number.NEGATIVE_INFINITY;

        for (const point of priceData) {
          const timestamp = (point as any).timestamp;
          const ms =
            typeof timestamp === "number"
              ? timestamp
              : Date.parse(String(timestamp || ""));

          if (Number.isFinite(ms)) {
            if (ms < candleFromMs) candleFromMs = ms;
            if (ms > candleToMs) candleToMs = ms;
          }
        }

        const candleRange = {
          from: usedFrom.toISOString(),
          to: usedTo.toISOString(),
          utcOffset: dukaConfigBase.utcOffset,
          receivedFrom:
            Number.isFinite(candleFromMs) && candleFromMs > 0
              ? new Date(candleFromMs).toISOString()
              : null,
          receivedTo:
            Number.isFinite(candleToMs) && candleToMs > 0
              ? new Date(candleToMs).toISOString()
              : null,
          count: priceData.length,
        } as const;

        const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
        const calculateDollarPerPip = () => {
          if (closePx != null) {
            const closePips =
              direction === "long"
                ? (closePx - entry) / pipSize
                : (entry - closePx) / pipSize;
            const profitValue = Number(currentTrade.profit || 0);
            if (closePips !== 0 && Math.abs(profitValue) > 0) {
              return Math.abs(profitValue / closePips);
            }
          }

          return 10 * volume;
        };

        const dollarPerPip = calculateDollarPerPip();

        if (direction === "long") {
          let minLow = entry;

          for (const point of priceData) {
            const low = Number(
              (point as any).low ?? (point as any).min ?? (point as any).l
            );
            const high = Number(
              (point as any).high ?? (point as any).max ?? (point as any).h
            );

            if (Number.isFinite(low)) minLow = Math.min(minLow, low);

            if (
              sl != null &&
              Number.isFinite(sl) &&
              sl > 0 &&
              Number.isFinite(low) &&
              low <= sl
            ) {
              const distToSlPips = Math.abs(sl - entry) / pipSize;
              const beCandidate = sl >= entry - tolPx;
              return {
                id: currentTrade.id,
                adversePips: Math.round(distToSlPips * 100) / 100,
                adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
                pctToSL: 100,
                hit: (beCandidate ? "BE" : "SL") as "BE" | "SL",
                dataSource: "dukascopy",
                candleRange,
                tickRange: null,
              };
            }

            if (tp != null && Number.isFinite(high) && high >= tp) break;
          }

          let adversePips = Math.max(0, entry - minLow) / pipSize;
          let adverseUsd = adversePips * dollarPerPip;
          let pctToSL: number | null = null;

          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL =
              distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
          }

          if (adversePips <= 0 && Number(currentTrade.profit || 0) > 0) {
            const tickFrom = openAt;
            const tickTo = closeAt;
            const ticks = await fetchTicks(tickFrom, tickTo);

            if (ticks.length) {
              let minBid = entry;

              for (const point of ticks) {
                const bid = Number((point as any).bidPrice);

                if (Number.isFinite(bid)) minBid = Math.min(minBid, bid);

                if (
                  sl != null &&
                  Number.isFinite(sl) &&
                  sl > 0 &&
                  Number.isFinite(bid) &&
                  bid <= sl
                ) {
                  const distToSlPips = Math.abs(sl - entry) / pipSize;
                  const beCandidate = sl >= entry - tolPx;
                  return {
                    id: currentTrade.id,
                    adversePips: Math.round(distToSlPips * 100) / 100,
                    adverseUsd:
                      Math.round(distToSlPips * dollarPerPip * 100) / 100,
                    pctToSL: 100,
                    hit: (beCandidate ? "BE" : "SL") as "BE" | "SL",
                    dataSource: "dukascopy",
                    candleRange,
                    tickRange: {
                      from: tickFrom.toISOString(),
                      to: tickTo.toISOString(),
                      utcOffset: dukaConfigBase.utcOffset,
                    },
                  };
                }

                if (tp != null && Number.isFinite(bid) && bid >= tp) break;
              }

              adversePips = Math.max(0, entry - minBid) / pipSize;
              adverseUsd = adversePips * dollarPerPip;

              if (sl != null && Number.isFinite(sl) && sl > 0) {
                const distToSlPips = Math.abs(sl - entry) / pipSize;
                pctToSL =
                  distToSlPips > 0
                    ? clamp01(adversePips / distToSlPips) * 100
                    : 0;
              }
            }
          }

          return {
            id: currentTrade.id,
            adversePips: Math.round(adversePips * 100) / 100,
            adverseUsd: Math.round(adverseUsd * 100) / 100,
            pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
            hit: "CLOSE" as const,
            dataSource: "dukascopy",
            candleRange,
            tickRange: null,
          };
        }

        let maxHigh = entry;

        for (const point of priceData) {
          const high = Number(
            (point as any).high ?? (point as any).max ?? (point as any).h
          );
          const low = Number(
            (point as any).low ?? (point as any).min ?? (point as any).l
          );

          if (Number.isFinite(high)) maxHigh = Math.max(maxHigh, high);

          if (
            sl != null &&
            Number.isFinite(sl) &&
            sl > 0 &&
            Number.isFinite(high) &&
            high >= sl
          ) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            const beCandidate = sl <= entry + tolPx;
            return {
              id: currentTrade.id,
              adversePips: Math.round(distToSlPips * 100) / 100,
              adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
              pctToSL: 100,
              hit: (beCandidate ? "BE" : "SL") as "BE" | "SL",
              dataSource: "dukascopy",
              candleRange,
              tickRange: null,
            };
          }

          if (tp != null && Number.isFinite(low) && low <= tp) break;
        }

        let adversePips = Math.max(0, maxHigh - entry) / pipSize;
        let adverseUsd = adversePips * dollarPerPip;
        let pctToSL: number | null = null;

        if (sl != null && Number.isFinite(sl) && sl > 0) {
          const distToSlPips = Math.abs(sl - entry) / pipSize;
          pctToSL =
            distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
        }

        if (adversePips <= 0 && Number(currentTrade.profit || 0) > 0) {
          const tickFrom = openAt;
          const tickTo = closeAt;
          const ticks = await fetchTicks(tickFrom, tickTo);

          if (ticks.length) {
            let maxAsk = entry;

            for (const point of ticks) {
              const ask = Number((point as any).askPrice);

              if (Number.isFinite(ask)) maxAsk = Math.max(maxAsk, ask);

              if (
                sl != null &&
                Number.isFinite(sl) &&
                sl > 0 &&
                Number.isFinite(ask) &&
                ask >= sl
              ) {
                const distToSlPips = Math.abs(sl - entry) / pipSize;
                const beCandidate = sl <= entry + tolPx;
                return {
                  id: currentTrade.id,
                  adversePips: Math.round(distToSlPips * 100) / 100,
                  adverseUsd:
                    Math.round(distToSlPips * dollarPerPip * 100) / 100,
                  pctToSL: 100,
                  hit: (beCandidate ? "BE" : "SL") as "BE" | "SL",
                  dataSource: "dukascopy",
                  candleRange,
                  tickRange: {
                    from: tickFrom.toISOString(),
                    to: tickTo.toISOString(),
                    utcOffset: dukaConfigBase.utcOffset,
                  },
                };
              }

              if (tp != null && Number.isFinite(ask) && ask <= tp) break;
            }

            adversePips = Math.max(0, maxAsk - entry) / pipSize;
            adverseUsd = adversePips * dollarPerPip;

            if (sl != null && Number.isFinite(sl) && sl > 0) {
              const distToSlPips = Math.abs(sl - entry) / pipSize;
              pctToSL =
                distToSlPips > 0
                  ? clamp01(adversePips / distToSlPips) * 100
                  : 0;
            }
          }
        }

        return {
          id: currentTrade.id,
          adversePips: Math.round(adversePips * 100) / 100,
          adverseUsd: Math.round(adverseUsd * 100) / 100,
          pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
          hit: "CLOSE" as const,
          dataSource: "dukascopy",
          candleRange,
          tickRange: null,
        };
      } catch (error: any) {
        console.error("[duka][err] drawdownForTrade:", error);
        return {
          id: input.id,
          adversePips: null,
          pctToSL: null,
          hit: "NONE" as const,
          dataSource: "error",
          error: String(error?.message || error),
        } as const;
      }
    }),
  drawdownForTrades: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1).max(1000),
        debug: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const rows = (await getTradeDrawdownRows(
        input.tradeIds
      )) as TradeDrawdownSourceRow[];
      if (!rows.length) {
        return {
          results: [] as Array<
            Awaited<ReturnType<typeof resolveTradeDrawdown>>
          >,
        };
      }

      const rowById = new Map(rows.map((row) => [row.id, row]));
      const orderedRows = input.tradeIds
        .map((id) => rowById.get(id))
        .filter((row): row is TradeDrawdownSourceRow => Boolean(row));

      const results = await resolveTradeDrawdowns(orderedRows, input.debug);

      return { results };
    }),
};
