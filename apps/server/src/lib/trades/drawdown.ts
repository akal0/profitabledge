import { getHistoricalRates } from "dukascopy-node";

import {
  getContractSizeForSymbol,
  getPipSizeForSymbol,
  mapToDukascopyInstrument,
} from "../dukascopy";
import { parseNaiveAsUTC } from "../../routers/trades/shared";

export type TradeDrawdownSourceRow = {
  id: string;
  useBrokerData?: boolean | number | null;
  createdAt: Date;
  openRaw: string | null;
  closeRaw: string | null;
  symbol: string | null;
  tradeType: string | null;
  volume: number | null;
  openPrice: number | null;
  sl: number | null;
  tp: number | null;
  closePrice: number | null;
  profit: number | null;
  commissions: number | null;
  swap: number | null;
  manipulationHigh: number | null;
  manipulationLow: number | null;
  manipulationPips: number | null;
  durationSecRaw: string | null;
};

export type TradeDrawdownResult =
  | {
      id: string;
      adversePips: number | null;
      adverseUsd?: number | null;
      pctToSL?: number | null;
      pctToStoploss?: number | null;
      hit: "Stop loss" | "CLOSE" | "NONE" | "BE";
      note?: string;
      dataSource?: string;
      candleRange?: {
        from: string;
        to: string;
        utcOffset: number;
        receivedFrom?: string | null;
        receivedTo?: string | null;
        count?: number;
      } | null;
      tickRange?: {
        from: string;
        to: string;
        utcOffset: number;
      } | null;
      error?: string;
    }
  | null
  | undefined;

const toNumber = (value: number | null | undefined, fallback = 0) =>
  value == null || Number.isNaN(Number(value)) ? fallback : Number(value);

async function fetchPriceSeries(
  configBase: Record<string, unknown>,
  timeframe: "m1" | "tick",
  from: Date,
  to: Date
) {
  const raw = (await getHistoricalRates({
    ...configBase,
    dates: { from, to },
    timeframe,
  } as any)) as any;
  return Array.isArray(raw) ? raw : [];
}

function createBaseResult(
  id: string,
  overrides: Partial<
    Exclude<TradeDrawdownResult, null | undefined> & { id: string }
  >
): Exclude<TradeDrawdownResult, null | undefined> {
  return {
    id,
    adversePips: null,
    hit: "NONE",
    ...overrides,
  } as Exclude<TradeDrawdownResult, null | undefined>;
}

export async function resolveTradeDrawdown(
  currentTrade: TradeDrawdownSourceRow,
  _debug = false
): Promise<TradeDrawdownResult> {
  try {
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
      currentTrade.closePrice != null ? Number(currentTrade.closePrice) : null;
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
      return createBaseResult(currentTrade.id, {
        adversePips: null,
        adverseUsd: null,
        pctToSL: null,
        pctToStoploss: null,
        hit: "NONE",
        note: "NO_ENTRY",
        dataSource: "none",
      });
    }

    if (
      currentTrade.manipulationHigh != null &&
      currentTrade.manipulationLow != null &&
      currentTrade.manipulationPips != null
    ) {
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
      let hit: "Stop loss" | "BE" | "CLOSE" = "CLOSE";

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
          hit = beCandidate ? "BE" : "Stop loss";
          pctToSL = 100;
        }
      }

      return createBaseResult(currentTrade.id, {
        adversePips: Math.round(adversePips * 100) / 100,
        adverseUsd: Math.round(adverseUsd * 100) / 100,
        pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
        pctToStoploss: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
        hit,
        dataSource: "manipulation",
      });
    }

    const parseDate = (raw: string | null, fallback: Date) =>
      parseNaiveAsUTC(raw) || fallback;

    const openAt = parseDate(currentTrade.openRaw, currentTrade.createdAt);
    let closeAt = parseDate(currentTrade.closeRaw, currentTrade.createdAt);
    const parsedDuration = currentTrade.durationSecRaw
      ? Number(currentTrade.durationSecRaw)
      : Number.NaN;

    if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
      closeAt = new Date(openAt.getTime() + Math.floor(parsedDuration) * 1000);
    }

    const minTo = new Date(openAt.getTime() + 60_000);
    if (!(closeAt.getTime() > openAt.getTime())) {
      closeAt = minTo;
    }

    const mapped = mapToDukascopyInstrument(symbol);
    const instrument = mapped.instrument || symbol.toLowerCase();
    const side: "bid" | "ask" = direction === "long" ? "bid" : "ask";

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

    const floorToMinute = (date: Date) =>
      new Date(Math.floor(date.getTime() / 60_000) * 60_000);
    const ceilToMinute = (date: Date) =>
      new Date(Math.ceil(date.getTime() / 60_000) * 60_000);

    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

    if (sl != null && Number.isFinite(sl) && sl > 0 && closePx != null) {
      const beCandidate =
        (direction === "long" && sl >= entry - tolPx) ||
        (direction === "short" && sl <= entry + tolPx);
      const hitByTolerance =
        (direction === "long" && closePx <= sl + tolPx) ||
        (direction === "short" && closePx >= sl - tolPx);

      if (hitByTolerance) {
        const pipsToSl = Math.abs(sl - entry) / pipSize;
        return createBaseResult(currentTrade.id, {
          adversePips: Math.round(pipsToSl * 100) / 100,
          adverseUsd: Math.round(pipsToSl * 10 * volume * 100) / 100,
          pctToSL: 100,
          pctToStoploss: 100,
          hit: beCandidate ? "BE" : "Stop loss",
          dataSource: "dukascopy",
        });
      }
    }

    if (Number(currentTrade.profit || 0) < 0 && closePx != null) {
      const adversePips = Math.abs(closePx - entry) / pipSize;
      const profitValue = Math.abs(Number(currentTrade.profit || 0));
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

      return createBaseResult(currentTrade.id, {
        adversePips: Math.round(adversePips * 100) / 100,
        adverseUsd: Math.round(adverseUsd * 100) / 100,
        pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
        pctToStoploss: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
        hit: "CLOSE",
        dataSource: "dukascopy",
      });
    }

    let usedFrom = floorToMinute(openAt);
    let usedTo = ceilToMinute(closeAt);
    let priceData: any[] = await fetchPriceSeries(
      dukaConfigBase,
      "m1",
      usedFrom,
      usedTo
    );

    if (!priceData.length) {
      const padMs = 60 * 1000;
      usedFrom = floorToMinute(new Date(openAt.getTime() - padMs));
      usedTo = ceilToMinute(new Date(closeAt.getTime() + padMs));
      priceData = await fetchPriceSeries(
        dukaConfigBase,
        "m1",
        usedFrom,
        usedTo
      );
    }

    if (!Array.isArray(priceData) || priceData.length === 0) {
      return createBaseResult(currentTrade.id, {
        adversePips: null,
        adverseUsd: null,
        pctToSL: null,
        pctToStoploss: null,
        hit: "NONE",
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
          utcOffset: dukaConfigBase.utcOffset as number,
        },
        tickRange: null,
      });
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
      utcOffset: dukaConfigBase.utcOffset as number,
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
          return createBaseResult(currentTrade.id, {
            adversePips: Math.round(distToSlPips * 100) / 100,
            adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
            pctToSL: 100,
            pctToStoploss: 100,
            hit: beCandidate ? "BE" : "Stop loss",
            dataSource: "dukascopy",
            candleRange,
            tickRange: null,
          });
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
        const ticks = await fetchPriceSeries(
          dukaConfigBase,
          "tick",
          tickFrom,
          tickTo
        );

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
              return createBaseResult(currentTrade.id, {
                adversePips: Math.round(distToSlPips * 100) / 100,
                adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
                pctToSL: 100,
                pctToStoploss: 100,
                hit: beCandidate ? "BE" : "Stop loss",
                dataSource: "dukascopy",
                candleRange,
                tickRange: {
                  from: tickFrom.toISOString(),
                  to: tickTo.toISOString(),
                  utcOffset: dukaConfigBase.utcOffset as number,
                },
              });
            }

            if (tp != null && Number.isFinite(bid) && bid >= tp) break;
          }

          adversePips = Math.max(0, entry - minBid) / pipSize;
          adverseUsd = adversePips * dollarPerPip;

          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL =
              distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
          }
        }
      }

      return createBaseResult(currentTrade.id, {
        adversePips: Math.round(adversePips * 100) / 100,
        adverseUsd: Math.round(adverseUsd * 100) / 100,
        pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
        pctToStoploss: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
        hit: "CLOSE",
        dataSource: "dukascopy",
        candleRange,
        tickRange: null,
      });
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
        return createBaseResult(currentTrade.id, {
          adversePips: Math.round(distToSlPips * 100) / 100,
          adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
          pctToSL: 100,
          pctToStoploss: 100,
          hit: beCandidate ? "BE" : "Stop loss",
          dataSource: "dukascopy",
          candleRange,
          tickRange: null,
        });
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
      const ticks = await fetchPriceSeries(
        dukaConfigBase,
        "tick",
        tickFrom,
        tickTo
      );

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
            return createBaseResult(currentTrade.id, {
              adversePips: Math.round(distToSlPips * 100) / 100,
              adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
              pctToSL: 100,
              pctToStoploss: 100,
              hit: beCandidate ? "BE" : "Stop loss",
              dataSource: "dukascopy",
              candleRange,
              tickRange: {
                from: tickFrom.toISOString(),
                to: tickTo.toISOString(),
                utcOffset: dukaConfigBase.utcOffset as number,
              },
            });
          }

          if (tp != null && Number.isFinite(ask) && ask <= tp) break;
        }

        adversePips = Math.max(0, maxAsk - entry) / pipSize;
        adverseUsd = adversePips * dollarPerPip;

        if (sl != null && Number.isFinite(sl) && sl > 0) {
          const distToSlPips = Math.abs(sl - entry) / pipSize;
          pctToSL =
            distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
        }
      }
    }

    return createBaseResult(currentTrade.id, {
      adversePips: Math.round(adversePips * 100) / 100,
      adverseUsd: Math.round(adverseUsd * 100) / 100,
      pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
      pctToStoploss: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
      hit: "CLOSE",
      dataSource: "dukascopy",
      candleRange,
      tickRange: null,
    });
  } catch (error: any) {
    console.error("[duka][err] resolveTradeDrawdown:", error);
    return createBaseResult(currentTrade.id, {
      adversePips: null,
      pctToSL: null,
      pctToStoploss: null,
      hit: "NONE",
      dataSource: "error",
      error: String(error?.message || error),
    });
  }
}

export async function resolveTradeDrawdowns(
  trades: TradeDrawdownSourceRow[],
  debug = false
) {
  return Promise.all(trades.map((trade) => resolveTradeDrawdown(trade, debug)));
}
