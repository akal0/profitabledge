import { router, protectedProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { trade, tradingAccount } from "../db/schema/trading";
import { user } from "../db/schema/auth";
import { and, desc, eq, lte, gte, sql } from "drizzle-orm";
import { getHistoricalRates } from "dukascopy-node";
import {
  mapToDukascopyInstrument,
  getPipSizeForSymbol,
  getContractSizeForSymbol,
} from "../lib/dukascopy";
import {
  getBrokerProfile,
  getExpectedSpread,
  calculateConfidenceScore,
} from "../lib/broker-profiles";
import { calculateAllAdvancedMetrics, type TradeData } from "../lib/advanced-metrics";

// Interpret naive CSV timestamps (without timezone) as GMT+3 (FTMO MT5) and convert to UTC Date
const ASSUMED_TZ_MINUTES = 0;
function parseNaiveAsTz(raw: string | null): Date | null {
  if (!raw) return null;
  const original = String(raw);
  // If timestamp includes an explicit timezone (Z or ±HH:MM), rely on Date parsing
  if (/[zZ]|[+\-]\d{2}:?\d{2}$/.test(original)) {
    const d = new Date(original);
    return isNaN(d.getTime()) ? null : d;
  }
  const cleaned = original
    .replace(/[^0-9\-: T]/g, "")
    .replace("T", " ")
    .trim();
  const m = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const s = Number(m[6] || "0");
    // Treat the naive components as being in GMT+3, then convert to UTC by subtracting offset
    const ms = Date.UTC(y, mo, d, h, mi, s) - ASSUMED_TZ_MINUTES * 60 * 1000;
    return new Date(ms);
  }
  const d2 = new Date(cleaned);
  return isNaN(d2.getTime()) ? null : d2;
}

// Parse a naive timestamp (no timezone) as UTC without shifting the wall time
function parseNaiveAsUTC(raw: string | null): Date | null {
  if (!raw) return null;
  const original = String(raw);
  const cleaned = original
    .replace(/[^0-9\-: T]/g, "")
    .replace("T", " ")
    .trim();
  const m = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] || "0");
  return new Date(Date.UTC(y, mo, d, h, mi, s));
}

export const tradesRouter = router({
  listInfinite: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        limit: z.number().min(1).max(200).default(50),
        cursor: z
          .object({ createdAtISO: z.string(), id: z.string() })
          .optional(),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
        q: z.string().optional(),

        tradeDirection: z.enum(["all", "long", "short"]).default("all"),
        symbols: z.array(z.string()).optional(),
        killzones: z.array(z.string()).optional(),
        // future: sort, filters
      })
    )
    .query(async ({ input, ctx }) => {
      const { accountId, limit } = input;

      // Fetch user preferences for advanced metrics
      const userId = ctx.session.user.id;
      const userRows = await db
        .select({ advancedMetricsPreferences: user.advancedMetricsPreferences })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const advancedPrefs = (userRows[0]?.advancedMetricsPreferences as any) || {};
      const disableSampleGating = advancedPrefs.disableSampleGating ?? false;

      const whereClauses: any[] = [eq(trade.accountId, accountId)];

      // createdAt based range filter (simple and efficient)
      if (input.startISO) {
        const s = new Date(input.startISO);
        if (!isNaN(s.getTime())) whereClauses.push(gte(trade.createdAt, s));
      }
      if (input.endISO) {
        const e = new Date(input.endISO);
        if (!isNaN(e.getTime())) whereClauses.push(lte(trade.createdAt, e));
      }

      if (input.tradeDirection && input.tradeDirection !== "all") {
        const dir = input.tradeDirection.toLowerCase();
        if (dir === "long" || dir === "buy") {
          whereClauses.push(sql`LOWER(${trade.tradeType}) IN ('long','buy')`);
        } else if (dir === "short" || dir === "sell") {
          whereClauses.push(sql`LOWER(${trade.tradeType}) IN ('short','sell')`);
        }
        // any other value => no direction filter
      }
      if (input.symbols && input.symbols.length) {
        // simple OR chain
        const ors = input.symbols.map((s) => eq(trade.symbol, s));
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.killzones && input.killzones.length) {
        // simple OR chain for killzones
        const ors = input.killzones.map((k) => eq(trade.killzone, k));
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.q && input.q.trim()) {
        const q = `%${input.q.trim()}%`;
        whereClauses.push(sql`LOWER(${trade.symbol}) LIKE LOWER(${q})`);
      }

      // cursor: (createdAtISO, id) for stable keyset pagination (desc)
      if (input.cursor) {
        const cDate = new Date(input.cursor.createdAtISO);
        const cId = input.cursor.id;
        // createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)
        whereClauses.push(
          sql`(${trade.createdAt} < ${cDate}) OR ((${trade.createdAt} = ${cDate}) AND (${trade.id} < ${cId}))`
        );
      }

      const rows = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          openRaw: sql<string | null>`(${trade.open})`,
          closeRaw: sql<string | null>`(${trade.close})`,
          createdAt: trade.createdAt,
          symbol: trade.symbol,
          tradeType: trade.tradeType,
          volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          slNum: sql<number | null>`CAST(${trade.sl} AS NUMERIC)`,
          tpNum: sql<number | null>`CAST(${trade.tp} AS NUMERIC)`,
          openPriceNum: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
          closePriceNum: sql<number | null>`CAST(${trade.closePrice} AS NUMERIC)`,
          commissions: sql<
            number | null
          >`CAST(${trade.commissions} AS NUMERIC)`,
          swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
          durationSecRaw: sql<string | null>`(${trade.tradeDurationSeconds})`,
          // Advanced metrics fields
          manipulationHigh: sql<number | null>`CAST(${trade.manipulationHigh} AS NUMERIC)`,
          manipulationLow: sql<number | null>`CAST(${trade.manipulationLow} AS NUMERIC)`,
          manipulationPips: sql<number | null>`CAST(${trade.manipulationPips} AS NUMERIC)`,
          entryPeakPrice: sql<number | null>`CAST(${trade.entryPeakPrice} AS NUMERIC)`,
          postExitPeakPrice: sql<number | null>`CAST(${trade.postExitPeakPrice} AS NUMERIC)`,
          alphaWeightedMpe: sql<number | null>`CAST(${trade.alphaWeightedMpe} AS NUMERIC)`,
          beThresholdPips: sql<number | null>`CAST(${trade.beThresholdPips} AS NUMERIC)`,
          // Killzone fields
          killzone: trade.killzone,
          killzoneColor: trade.killzoneColor,
        })
        .from(trade)
        .where(and(...whereClauses))
        .orderBy(desc(trade.createdAt), desc(trade.id))
        .limit(limit + 1);

      const parseOpen = (raw: string | null, createdAt: Date): string => {
        const d = parseNaiveAsTz(raw);
        return (d || createdAt).toISOString();
      };
      const parseClose = (raw: string | null, fallback: Date): string => {
        const d = parseNaiveAsTz(raw);
        return (d || fallback).toISOString();
      };

      let nextCursor: { createdAtISO: string; id: string } | undefined =
        undefined;
      let items = rows;
      if (rows.length > limit) {
        const last = rows[rows.length - 1];
        nextCursor = {
          createdAtISO: last.createdAt.toISOString(),
          id: last.id,
        };
        items = rows.slice(0, limit);
      }

      // Get total trades count for this account (for sample-size gating)
      const totalTradesCount = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .then((res) => res[0]?.count ?? 0);

      const result = items.map((r) => {
        const tt = String(r.tradeType || "").toLowerCase();
        const direction: "long" | "short" =
          tt === "short" || tt === "sell" ? "short" : "long";
        // Produce stable ISO strings by interpreting DB times as UTC (no shift)
        const openISO = (
          parseNaiveAsUTC(r.openRaw) || r.createdAt
        ).toISOString();
        const closeISO = (
          parseNaiveAsUTC(r.closeRaw) || r.createdAt
        ).toISOString();
        const parsedDuration = r.durationSecRaw
          ? Number(r.durationSecRaw)
          : NaN;
        const holdSeconds = Number.isFinite(parsedDuration)
          ? Math.max(0, Math.floor(parsedDuration))
          : Math.max(
              0,
              Math.floor(
                (new Date(closeISO).getTime() - new Date(openISO).getTime()) /
                  1000
              )
            );

        // Prepare trade data for advanced metrics calculation
        const tradeData: TradeData = {
          id: r.id,
          symbol: r.symbol || "",
          tradeDirection: direction,
          entryPrice: Number(r.openPriceNum || 0),
          sl: r.slNum != null ? Number(r.slNum) : null,
          tp: r.tpNum != null ? Number(r.tpNum) : null,
          closePrice: r.closePriceNum != null ? Number(r.closePriceNum) : null,
          profit: Number(r.profit || 0),
          commissions: r.commissions != null ? Number(r.commissions) : null,
          swap: r.swap != null ? Number(r.swap) : null,
          volume: Number(r.volume || 0),
          manipulationHigh: r.manipulationHigh != null ? Number(r.manipulationHigh) : null,
          manipulationLow: r.manipulationLow != null ? Number(r.manipulationLow) : null,
          manipulationPips: r.manipulationPips != null ? Number(r.manipulationPips) : null,
          entryPeakPrice: r.entryPeakPrice != null ? Number(r.entryPeakPrice) : null,
          postExitPeakPrice: r.postExitPeakPrice != null ? Number(r.postExitPeakPrice) : null,
          alphaWeightedMpe: r.alphaWeightedMpe != null ? Number(r.alphaWeightedMpe) : 0.30,
          beThresholdPips: r.beThresholdPips != null ? Number(r.beThresholdPips) : 0.5,
        };

        // Calculate all advanced metrics
        const advancedMetrics = calculateAllAdvancedMetrics(tradeData, totalTradesCount, disableSampleGating);

        return {
          id: r.id,
          open: openISO,
          close: closeISO,
          symbol: r.symbol || "",
          tradeDirection: direction,
          volume: Number(r.volume || 0),
          profit: Number(r.profit || 0),
          sl: r.slNum != null ? Number(r.slNum) : null,
          tp: r.tpNum != null ? Number(r.tpNum) : null,
          commissions: r.commissions != null ? Number(r.commissions) : null,
          swap: r.swap != null ? Number(r.swap) : null,
          createdAtISO: r.createdAt.toISOString(),
          holdSeconds,
          // Killzone fields
          killzone: r.killzone || null,
          killzoneColor: r.killzoneColor || null,
          // Advanced metrics (all derived, never null-unsafe)
          manipulationPips: advancedMetrics.manipulationPips,
          mpeManipLegR: advancedMetrics.mpeManipLegR,
          mpeManipPE_R: advancedMetrics.mpeManipPE_R,
          maxRR: advancedMetrics.maxRR,
          realisedRR: advancedMetrics.realisedRR,
          rrCaptureEfficiency: advancedMetrics.rrCaptureEfficiency,
          manipRREfficiency: advancedMetrics.manipRREfficiency,
          rawSTDV: advancedMetrics.rawSTDV,
          rawSTDV_PE: advancedMetrics.rawSTDV_PE,
          stdvBucket: advancedMetrics.stdvBucket,
          estimatedWeightedMPE_R: advancedMetrics.estimatedWeightedMPE_R,
          outcome: advancedMetrics.outcome,
        };
      });

      return { items: result, nextCursor } as const;
    }),
  listSymbols: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const rows = await db
        .select({ symbol: trade.symbol })
        .from(trade)
        .where(eq(trade.accountId, input.accountId));
      const set = new Set<string>();
      for (const r of rows) if (r.symbol) set.add(r.symbol);
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }),
  listKillzones: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const rows = await db
        .select({ killzone: trade.killzone, killzoneColor: trade.killzoneColor })
        .from(trade)
        .where(eq(trade.accountId, input.accountId));
      const killzoneMap = new Map<string, string>();
      for (const r of rows) {
        if (r.killzone) {
          killzoneMap.set(r.killzone, r.killzoneColor || "#FF5733");
        }
      }
      return Array.from(killzoneMap.entries())
        .map(([name, color]) => ({ name, color }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }),
  drawdownForTrade: protectedProcedure
    .input(z.object({ id: z.string().min(1), debug: z.boolean().optional() }))
    .query(async ({ input }) => {
      try {
        const row = await db
          .select({
            id: trade.id,
            accountId: trade.accountId,
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
            commissions: sql<number | null>`CAST(${trade.commissions} AS NUMERIC)`,
            swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
            // Manipulation structure fields from EA
            manipulationHigh: sql<number | null>`CAST(${trade.manipulationHigh} AS NUMERIC)`,
            manipulationLow: sql<number | null>`CAST(${trade.manipulationLow} AS NUMERIC)`,
            manipulationPips: sql<number | null>`CAST(${trade.manipulationPips} AS NUMERIC)`,
          })
          .from(trade)
          .where(eq(trade.id, input.id))
          .limit(1);

        if (!row.length) return null;
        const r = row[0];
        const debugEnabled = Boolean(input.debug);

        // NEW: Check if we have manipulation data from EA (preferred method)
        const hasManipulationData =
          r.manipulationHigh != null &&
          r.manipulationLow != null &&
          r.manipulationPips != null;

        const symbol = (r.symbol || "").toUpperCase();
        const entry = Number(r.openPrice || 0);

        // Treat 0 as null for SL/TP (no SL/TP set)
        // Note: MT5 sends 0 when no SL/TP is set
        const sl = r.sl != null && Number(r.sl) > 0 ? Number(r.sl) : null;
        const tp = r.tp != null && Number(r.tp) > 0 ? Number(r.tp) : null;
        const closePx = r.closePrice != null ? Number(r.closePrice) : null;
        const direction =
          String(r.tradeType || "")
            .toLowerCase()
            .includes("short") ||
          String(r.tradeType || "")
            .toLowerCase()
            .includes("sell")
            ? "short"
            : "long";

        const pipSize = getPipSizeForSymbol(symbol);
        const contractSize = getContractSizeForSymbol(symbol);
        const tolPx = pipSize * 0.5; // 0.5 pip tolerance
        const volume = Number(r.volume || 1);

        // If no entry price, can't calculate anything
        if (!(entry > 0)) {
          return {
            id: r.id,
            adversePips: 0,
            adverseUsd: 0,
            pctToSL: null,
            hit: "NONE" as const,
            note: "NO_ENTRY",
            dataSource: "none",
          } as any;
        }

        // NEW: Use manipulation data if available (from EA broker data)
        if (hasManipulationData) {
          const manipHigh = Number(r.manipulationHigh);
          const manipLow = Number(r.manipulationLow);

          if (debugEnabled) {
            console.log("[dd][dbg] USING_MANIPULATION_DATA", {
              id: r.id,
              symbol,
              direction,
              entry,
              sl,
              tp,
              manipHigh,
              manipLow,
              manipPips: r.manipulationPips,
            });
          }

          // Calculate adverse movement from manipulation data
          let adversePips = 0;
          if (direction === "long") {
            // For longs: entry - manipLow
            const adverse = Math.max(0, entry - manipLow);
            adversePips = adverse / pipSize;
          } else {
            // For shorts: manipHigh - entry
            const adverse = Math.max(0, manipHigh - entry);
            adversePips = adverse / pipSize;
          }

          // Calculate USD value using the profit as reference
          // First, calculate the pip movement from entry to close
          let closePips = 0;
          if (closePx != null) {
            if (direction === "long") {
              closePips = (closePx - entry) / pipSize;
            } else {
              closePips = (entry - closePx) / pipSize;
            }
          }

          // Calculate dollar value per pip from the actual profit INCLUDING commissions and swap
          // This gives us the true cost per pip movement for this trade
          const profitValue = Number(r.profit || 0);
          const commissionsValue = Number(r.commissions || 0);
          const swapValue = Number(r.swap || 0);
          const netProfitLoss = profitValue + commissionsValue + swapValue;
          let dollarPerPip = 0;

          if (closePips !== 0 && Math.abs(netProfitLoss) > 0) {
            // Use net P&L (with all costs) divided by pip movement
            dollarPerPip = Math.abs(netProfitLoss / closePips);
          } else {
            // Fallback: use standard calculation (may not be accurate for all pairs)
            dollarPerPip = 10 * volume; // $10 per pip per standard lot for USD pairs
          }

          const adverseUsd = adversePips * dollarPerPip;

          // If there's an SL, calculate % to SL and check if it was hit
          let pctToSL: number | null = null;
          let hit: "SL" | "BE" | "TP" | "CLOSE" = "CLOSE";

          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL = distToSlPips > 0
              ? Math.max(0, Math.min(100, (adversePips / distToSlPips) * 100))
              : 0;

            // Check if SL was actually hit
            let slHit = false;
            if (direction === "long") {
              slHit = manipLow <= sl + tolPx;
            } else {
              slHit = manipHigh >= sl - tolPx;
            }

            if (slHit) {
              const beCandidate =
                (direction === "long" && sl >= entry - tolPx) ||
                (direction === "short" && sl <= entry + tolPx);
              hit = beCandidate ? "BE" : "SL";
              pctToSL = 100;
            }
          }

          if (debugEnabled) {
            console.log("[dd][dbg] RESULT_FROM_MANIPULATION", {
              id: r.id,
              symbol,
              direction,
              adversePips: Math.round(adversePips * 100) / 100,
              adverseUsd: Math.round(adverseUsd * 100) / 100,
              pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
              hit,
              hasSL: sl != null,
            });
          }

          return {
            id: r.id,
            adversePips: Math.round(adversePips * 100) / 100,
            adverseUsd: Math.round(adverseUsd * 100) / 100,
            pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
            hit,
            dataSource: "manipulation",
          };
        }

        // FALLBACK: Use Dukascopy API when manipulation data not available
        if (debugEnabled) {
          console.log("[dd][dbg] FALLBACK_TO_DUKASCOPY", {
            id: r.id,
            symbol,
            hasManipulationData: false,
          });
        }

        // Fetch account info for broker calibration
        const accountRow = await db
          .select({
            broker: tradingAccount.broker,
            brokerType: tradingAccount.brokerType,
            preferredDataSource: tradingAccount.preferredDataSource,
            averageSpreadPips: tradingAccount.averageSpreadPips,
          })
          .from(tradingAccount)
          .where(eq(tradingAccount.id, r.accountId))
          .limit(1);

        const account = accountRow[0] || {
          broker: null,
          brokerType: null,
          preferredDataSource: "dukascopy",
          averageSpreadPips: null,
        };

        const parseDate = (raw: string | null, fallback: Date) => {
          // Use DB-provided wall time without shifting; Dukascopy handles tz via utcOffset
          const d = parseNaiveAsUTC(raw);
          return d || fallback;
        };

        const openAt = parseDate(r.openRaw, r.createdAt);
        let closeAt = parseDate(r.closeRaw, r.createdAt);
        const parsedDuration = r.durationSecRaw
          ? Number(r.durationSecRaw)
          : NaN;
        if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
          closeAt = new Date(
            openAt.getTime() + Math.floor(parsedDuration) * 1000
          );
        }
        // ensure a positive window (min +60s)
        const minTo = new Date(openAt.getTime() + 60_000);
        if (!(closeAt.getTime() > openAt.getTime())) {
          closeAt = minTo;
        }

        const mapped = mapToDukascopyInstrument(symbol);
        const instrument = mapped.instrument || symbol.toLowerCase();
        const side: "bid" | "ask" = direction === "long" ? "bid" : "ask";
        // Treat close at-or-near SL (within tolerance) as SL hit (or BE when SL ~ entry)
        if (sl != null && Number.isFinite(sl) && sl > 0 && closePx != null) {
          const beCandidate =
            (direction === "long" && sl >= entry - tolPx) ||
            (direction === "short" && sl <= entry + tolPx);
          const hitByTolerance =
            (direction === "long" && closePx <= sl + tolPx) ||
            (direction === "short" && closePx >= sl - tolPx);
          if (hitByTolerance) {
            const pipsToSl0 = Math.abs(sl - entry) / pipSize;
            if (debugEnabled) {
              console.log("[duka][dbg] EXACT_SL_CLOSE", {
                id: r.id,
                symbol,
                instrument,
                profit: r.profit,
                side,
                entry,
                sl,
                tp,
                closePx,
                pipsToSl: Math.round(pipsToSl0 * 100) / 100,
                timeframe: "m1",
                be: beCandidate,
              });
            }
            return {
              id: r.id,
              adversePips: Math.round(pipsToSl0 * 100) / 100,
              pctToSL: 100,
              hit: (beCandidate ? "BE" : "SL") as "BE" | "SL",
              dataSource: "dukascopy",
            } as any;
          }
        }
        // If closed in drawdown (profit < 0 and closePx present), compute from prices only
        if (r.profit != null && Number(r.profit) < 0 && closePx != null) {
          const adversePips = Math.abs(closePx - entry) / pipSize;
          // Use the actual profit to calculate dollar per pip
          const profitValue = Math.abs(Number(r.profit));
          const dollarPerPip = adversePips > 0 ? profitValue / adversePips : 10 * volume;
          const adverseUsd = adversePips * dollarPerPip;

          let pctToSL: number | null = null;
          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL = distToSlPips > 0
              ? Math.max(0, Math.min(100, (adversePips / distToSlPips) * 100))
              : 0;
          }

          if (debugEnabled) {
            console.log("[duka][dbg] CLOSED_IN_DD", {
              id: r.id,
              symbol,
              instrument,
              profit: r.profit,
              side,
              entry,
              sl,
              tp,
              closePx,
              adversePips: Math.round(adversePips * 100) / 100,
              adverseUsd: Math.round(adverseUsd * 100) / 100,
              pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
              timeframe: "m1",
            });
          }
          return {
            id: r.id,
            adversePips: Math.round(adversePips * 100) / 100,
            adverseUsd: Math.round(adverseUsd * 100) / 100,
            pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
            hit: "CLOSE" as const,
            dataSource: "dukascopy",
          };
        }

        const timeframe = "m1" as const;
        const dukaConfigBase = {
          instrument,
          format: "json" as const,
          priceType: side,
          volumes: false,
          ignoreFlats: false,
          batchSize: 10,
          pauseBetweenBatchesMs: 1000,
          utcOffset: -120,
          // useCache: true,
        };

        async function fetchM1(from: Date, to: Date) {
          const cfg = {
            ...dukaConfigBase,
            dates: { from, to },
            timeframe: "m1",
          } as any;
          const raw = (await getHistoricalRates(cfg)) as any;
          return Array.isArray(raw) ? raw : [];
        }

        async function fetchTicks(from: Date, to: Date) {
          const cfg = {
            ...dukaConfigBase,
            dates: { from, to },
            timeframe: "tick",
          } as any;
          const raw = (await getHistoricalRates(cfg)) as any;
          return Array.isArray(raw) ? raw : [];
        }

        console.log("[duka][req] drawdownForTrade", {
          id: r.id,
          instrument,
          side,
          timeframe,
          direction,
          pnl: r.profit,
          from: openAt.toISOString(),
          to: closeAt.toISOString(),
          originalSymbol: symbol,
          utcOffset: dukaConfigBase.utcOffset,
        });
        // Round to whole-minute boundaries for candle requests
        const floorToMinute = (d: Date) =>
          new Date(Math.floor(d.getTime() / 60_000) * 60_000);
        const ceilToMinute = (d: Date) =>
          new Date(Math.ceil(d.getTime() / 60_000) * 60_000);
        let usedFrom = floorToMinute(openAt);
        let usedTo = ceilToMinute(closeAt);
        let priceData: any[] = await fetchM1(usedFrom, usedTo);
        if (!priceData.length) {
          const padMs = 60 * 1000;
          usedFrom = floorToMinute(new Date(openAt.getTime() - padMs));
          usedTo = ceilToMinute(new Date(closeAt.getTime() + padMs));
          priceData = await fetchM1(usedFrom, usedTo);
        }
        // Removed 15m extension; use exact trade window only

        if (!Array.isArray(priceData) || priceData.length === 0) {
          if (debugEnabled) {
            console.log("[duka][dbg] NO_PRICE_DATA", {
              id: r.id,
              symbol,
              instrument,
              side,
              profit: r.profit,
              entry,
              sl,
              tp,
              openAt: openAt.toISOString(),
              closeAt: closeAt.toISOString(),
              timeframe,
              candleRange: {
                from: usedFrom.toISOString(),
                to: usedTo.toISOString(),
                utcOffset: dukaConfigBase.utcOffset,
              },
            });
          }
          return {
            id: r.id,
            adversePips: 0,
            pctToSL: 0,
            hit: "NONE" as const,
            dataSource: "dukascopy",
            candleRange: {
              from: usedFrom.toISOString(),
              to: usedTo.toISOString(),
              utcOffset: dukaConfigBase.utcOffset,
            },
            tickRange: null,
          };
        }

        if (debugEnabled) {
          try {
            const sample = priceData[0];
            console.log("[duka][dbg] SAMPLE_KEYS", Object.keys(sample || {}));
          } catch {}
        }

        // Compute actual candle range returned by Dukascopy
        let candleFromMs = Number.POSITIVE_INFINITY;
        let candleToMs = Number.NEGATIVE_INFINITY;
        for (const t of priceData) {
          const tv: any = (t as any).timestamp;
          const ms = typeof tv === "number" ? tv : Date.parse(String(tv || ""));
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

        const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

        // Helper: Calculate dollar per pip from actual profit/loss
        const calculateDollarPerPip = () => {
          if (closePx != null) {
            let closePips = 0;
            if (direction === "long") {
              closePips = (closePx - entry) / pipSize;
            } else {
              closePips = (entry - closePx) / pipSize;
            }
            const profitValue = Number(r.profit || 0);
            if (closePips !== 0 && Math.abs(profitValue) > 0) {
              return Math.abs(profitValue / closePips);
            }
          }
          // Fallback: standard calculation
          return 10 * volume; // $10 per pip per lot for most USD pairs
        };

        const dollarPerPip = calculateDollarPerPip();

        if (direction === "long") {
          let minLow = entry;
          for (const t of priceData) {
            const low = Number(
              (t as any).low ?? (t as any).min ?? (t as any).l
            );
            const high = Number(
              (t as any).high ?? (t as any).max ?? (t as any).h
            );
            if (Number.isFinite(low)) minLow = Math.min(minLow, low);

            // Check if SL was hit (only if SL exists)
            if (sl != null && Number.isFinite(sl) && sl > 0 && Number.isFinite(low) && low <= sl) {
              const distToSlPips = Math.abs(sl - entry) / pipSize;
              const beCandidate = sl >= entry - tolPx;
              return {
                id: r.id,
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
          const adverse = Math.max(0, entry - minLow);
          let adversePips = adverse / pipSize;
          let adverseUsd = adversePips * dollarPerPip;

          // Calculate % to SL only if SL exists
          let pctToSL: number | null = null;
          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL = distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
          }

          // Tick fallback (full trade window) when m1 shows no adverse movement but trade is profitable
          if (adversePips <= 0 && Number(r.profit || 0) > 0) {
            const tickFrom = openAt;
            const tickTo = closeAt;
            const ticks = await fetchTicks(tickFrom, tickTo);
            if (ticks.length) {
              let minBid2 = entry;
              for (const t of ticks) {
                const bid = Number((t as any).bidPrice);
                const ask = Number((t as any).askPrice);
                if (Number.isFinite(bid)) minBid2 = Math.min(minBid2, bid);

                // Check if SL was hit (only if SL exists)
                if (sl != null && Number.isFinite(sl) && sl > 0 && Number.isFinite(bid) && bid <= sl) {
                  const distToSlPips = Math.abs(sl - entry) / pipSize;
                  const beCandidate = sl >= entry - tolPx;
                  return {
                    id: r.id,
                    adversePips: Math.round(distToSlPips * 100) / 100,
                    adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
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
                // For longs, TP triggers on bid >= tp (exit at bid)
                if (tp != null && Number.isFinite(bid) && bid >= tp) break;
              }
              const adverse2 = Math.max(0, entry - minBid2);
              adversePips = adverse2 / pipSize;
              adverseUsd = adversePips * dollarPerPip;

              // Recalculate % to SL if SL exists
              if (sl != null && Number.isFinite(sl) && sl > 0) {
                const distToSlPips = Math.abs(sl - entry) / pipSize;
                pctToSL = distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
              }
              if (debugEnabled) {
                console.log("[duka][dbg] TICK_FALLBACK_LONG", {
                  id: r.id,
                  symbol,
                  instrument,
                  profit: r.profit,
                  side,
                  entry,
                  sl,
                  tp,
                  ticksCount: ticks.length,
                  minBid2,
                  adversePips: Math.round(adversePips * 100) / 100,
                  adverseUsd: Math.round(adverseUsd * 100) / 100,
                  pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
                  timeframe: "tick",
                  candleRange,
                  tickRange: {
                    from: tickFrom.toISOString(),
                    to: tickTo.toISOString(),
                    utcOffset: dukaConfigBase.utcOffset,
                  },
                });
              }
            }
          }
          if (debugEnabled) {
            console.log("[duka][dbg] RESULT_LONG", {
              id: r.id,
              symbol,
              instrument,
              profit: r.profit,
              side,
              entry,
              sl,
              tp,
              priceDataCount: priceData.length,
              minLow,
              adversePips: Math.round(adversePips * 100) / 100,
              adverseUsd: Math.round(adverseUsd * 100) / 100,
              pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
              timeframe,
              candleRange,
            });
          }
          return {
            id: r.id,
            adversePips: Math.round(adversePips * 100) / 100,
            adverseUsd: Math.round(adverseUsd * 100) / 100,
            pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
            hit: "CLOSE" as const,
            dataSource: "dukascopy",
            candleRange,
            tickRange: null,
          };
        } else {
          // Short trades
          let maxHigh = entry;
          for (const t of priceData) {
            const high = Number(
              (t as any).high ?? (t as any).max ?? (t as any).h
            );
            const low = Number(
              (t as any).low ?? (t as any).min ?? (t as any).l
            );
            if (Number.isFinite(high)) maxHigh = Math.max(maxHigh, high);

            // Check if SL was hit (only if SL exists)
            if (sl != null && Number.isFinite(sl) && sl > 0 && Number.isFinite(high) && high >= sl) {
              const distToSlPips = Math.abs(sl - entry) / pipSize;
              const beCandidate = sl <= entry + tolPx;
              return {
                id: r.id,
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
          const adverse = Math.max(0, maxHigh - entry);
          let adversePips = adverse / pipSize;
          let adverseUsd = adversePips * dollarPerPip;

          // Calculate % to SL only if SL exists
          let pctToSL: number | null = null;
          if (sl != null && Number.isFinite(sl) && sl > 0) {
            const distToSlPips = Math.abs(sl - entry) / pipSize;
            pctToSL = distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
          }

          // Tick fallback (full trade window) when m1 shows no adverse movement but trade is profitable
          if (adversePips <= 0 && Number(r.profit || 0) > 0) {
            const tickFrom = openAt;
            const tickTo = closeAt;
            const ticks = await fetchTicks(tickFrom, tickTo);
            if (ticks.length) {
              let maxAsk2 = entry;
              for (const t of ticks) {
                const ask = Number((t as any).askPrice);
                const bid = Number((t as any).bidPrice);
                if (Number.isFinite(ask)) maxAsk2 = Math.max(maxAsk2, ask);

                // Check if SL was hit (only if SL exists)
                if (sl != null && Number.isFinite(sl) && sl > 0 && Number.isFinite(ask) && ask >= sl) {
                  const distToSlPips = Math.abs(sl - entry) / pipSize;
                  const beCandidate = sl <= entry + tolPx;
                  return {
                    id: r.id,
                    adversePips: Math.round(distToSlPips * 100) / 100,
                    adverseUsd: Math.round(distToSlPips * dollarPerPip * 100) / 100,
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
                // For shorts, TP triggers on ask <= tp (exit at ask)
                if (tp != null && Number.isFinite(ask) && ask <= tp) break;
              }
              const adverse2 = Math.max(0, maxAsk2 - entry);
              adversePips = adverse2 / pipSize;
              adverseUsd = adversePips * dollarPerPip;

              // Recalculate % to SL if SL exists
              if (sl != null && Number.isFinite(sl) && sl > 0) {
                const distToSlPips = Math.abs(sl - entry) / pipSize;
                pctToSL = distToSlPips > 0 ? clamp01(adversePips / distToSlPips) * 100 : 0;
              }
              if (debugEnabled) {
                console.log("[duka][dbg] TICK_FALLBACK_SHORT", {
                  id: r.id,
                  symbol,
                  instrument,
                  profit: r.profit,
                  side,
                  entry,
                  sl,
                  tp,
                  ticksCount: ticks.length,
                  maxAsk2,
                  adversePips: Math.round(adversePips * 100) / 100,
                  adverseUsd: Math.round(adverseUsd * 100) / 100,
                  pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
                  timeframe: "tick",
                  candleRange,
                  tickRange: {
                    from: tickFrom.toISOString(),
                    to: tickTo.toISOString(),
                    utcOffset: dukaConfigBase.utcOffset,
                  },
                });
              }
            }
          }
          if (debugEnabled) {
            console.log("[duka][dbg] RESULT_SHORT", {
              id: r.id,
              symbol,
              instrument,
              profit: r.profit,
              side,
              entry,
              sl,
              tp,
              priceDataCount: priceData.length,
              maxHigh,
              adversePips: Math.round(adversePips * 100) / 100,
              adverseUsd: Math.round(adverseUsd * 100) / 100,
              pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
              timeframe,
              candleRange,
            });
          }
          return {
            id: r.id,
            adversePips: Math.round(adversePips * 100) / 100,
            adverseUsd: Math.round(adverseUsd * 100) / 100,
            pctToSL: pctToSL != null ? Math.round(pctToSL * 100) / 100 : null,
            hit: "CLOSE" as const,
            dataSource: "dukascopy",
            candleRange,
            tickRange: null,
          };
        }
      } catch (error: any) {
        console.error("[duka][err] drawdownForTrade:", error);
        // Return a JSON-safe error payload instead of throwing HTML/500
        return {
          id: input.id,
          adversePips: null,
          pctToSL: null,
          hit: "NONE" as const,
          dataSource: "error",
          error: String(error?.message || error),
        } as any;
      }
    }),

  // Update killzone tag for a trade
  updateKillzone: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        killzone: z.string().nullable(),
        killzoneColor: z.union([
          z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          z.null(),
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeId, killzone, killzoneColor } = input;

      // Verify the trade belongs to the user's account
      const tradeRow = await db
        .select({ accountId: trade.accountId })
        .from(trade)
        .where(eq(trade.id, tradeId))
        .limit(1);

      if (!tradeRow.length) {
        throw new Error("Trade not found");
      }

      const accountRow = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, tradeRow[0].accountId))
        .limit(1);

      if (!accountRow.length || accountRow[0].userId !== ctx.session.user.id) {
        throw new Error("Unauthorized");
      }

      // Update the killzone
      await db
        .update(trade)
        .set({
          killzone,
          killzoneColor,
        })
        .where(eq(trade.id, tradeId));

      return { success: true };
    }),
});
