import { router, protectedProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { trade, tradingAccount } from "../db/schema/trading";
import { user } from "../db/schema/auth";
import { and, desc, eq, lte, gte, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
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
import {
  updateAccountManipulation,
  updateAccountPostExitPeaks,
} from "../lib/manipulation-calculator";
import { evaluateCompliance } from "../lib/compliance-audits";
import { scoreOpenTrade } from "../lib/trade-scoring";
import { enhancedCache, CacheTTL, cacheNamespaces } from "../lib/enhanced-cache";
import {
  ALL_ACCOUNTS_ID,
  buildAccountScopeCondition,
  resolveScopedAccountIds,
} from "../lib/account-scope";

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

function getMt5BrokerMeta(
  brokerMeta: unknown
): Record<string, unknown> | null {
  if (!brokerMeta || typeof brokerMeta !== "object" || Array.isArray(brokerMeta)) {
    return null;
  }

  return brokerMeta as Record<string, unknown>;
}

function getMt5BrokerString(
  brokerMeta: unknown,
  key: string
): string | null {
  const meta = getMt5BrokerMeta(brokerMeta);
  const value = meta?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getMt5BrokerNumber(
  brokerMeta: unknown,
  key: string
): number | null {
  const meta = getMt5BrokerMeta(brokerMeta);
  const value = meta?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function invalidateTradeScopeCaches(accountIds: string[]) {
  const cacheTags = new Set<string>([`account:${ALL_ACCOUNTS_ID}`]);
  for (const accountId of accountIds) {
    if (accountId) {
      cacheTags.add(`account:${accountId}`);
    }
  }

  await enhancedCache.invalidateByTags([...cacheTags]);
}

export const tradesRouter = router({
  // Get a single trade by ID
  getById: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          symbol: trade.symbol,
          tradeType: trade.tradeType,
          volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
          openPrice: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
          closePrice: sql<number | null>`CAST(${trade.closePrice} AS NUMERIC)`,
          sl: sql<number | null>`CAST(${trade.sl} AS NUMERIC)`,
          tp: sql<number | null>`CAST(${trade.tp} AS NUMERIC)`,
          profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
          pips: sql<number | null>`CAST(${trade.pips} AS NUMERIC)`,
          openTime: trade.openTime,
          closeTime: trade.closeTime,
          outcome: trade.outcome,
          sessionTag: trade.sessionTag,
          modelTag: trade.modelTag,
          entryPeakPrice: sql<number | null>`CAST(${trade.entryPeakPrice} AS NUMERIC)`,
          postExitPeakPrice: sql<number | null>`CAST(${trade.postExitPeakPrice} AS NUMERIC)`,
          mfePips: sql<number | null>`CAST(${trade.mfePips} AS NUMERIC)`,
          maePips: sql<number | null>`CAST(${trade.maePips} AS NUMERIC)`,
          realisedRR: sql<number | null>`CAST(${trade.realisedRR} AS NUMERIC)`,
          plannedRR: sql<number | null>`CAST(${trade.plannedRR} AS NUMERIC)`,
          manipulationHigh: sql<number | null>`CAST(${trade.manipulationHigh} AS NUMERIC)`,
          manipulationLow: sql<number | null>`CAST(${trade.manipulationLow} AS NUMERIC)`,
          brokerMeta: trade.brokerMeta,
        })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      // Verify ownership through account
      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, result[0].accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      return {
        ...result[0],
        brokerMeta: result[0].brokerMeta ?? null,
        closeReason: getMt5BrokerString(result[0].brokerMeta, "closeReason"),
        entrySource: getMt5BrokerString(result[0].brokerMeta, "entrySource"),
        exitSource: getMt5BrokerString(result[0].brokerMeta, "exitSource"),
        executionMode: getMt5BrokerString(result[0].brokerMeta, "executionMode"),
        magicNumber: getMt5BrokerNumber(result[0].brokerMeta, "magicNumber"),
      };
    }),

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
        ids: z.array(z.string()).optional(),
        symbols: z.array(z.string()).optional(),
        killzones: z.array(z.string()).optional(),
        sessionTags: z.array(z.string()).optional(),
        modelTags: z.array(z.string()).optional(),
        protocolAlignment: z
          .array(z.enum(["aligned", "against", "discretionary"]))
          .optional(),
        outcomes: z.array(z.enum(["Win", "Loss", "BE", "PW"])).optional(),
        holdMin: z.number().optional(),
        holdMax: z.number().optional(),
        volumeMin: z.number().optional(),
        volumeMax: z.number().optional(),
        profitMin: z.number().optional(),
        profitMax: z.number().optional(),
        commissionsMin: z.number().optional(),
        commissionsMax: z.number().optional(),
        swapMin: z.number().optional(),
        swapMax: z.number().optional(),
        slMin: z.number().optional(),
        slMax: z.number().optional(),
        tpMin: z.number().optional(),
        tpMax: z.number().optional(),
        rrMin: z.number().optional(),
        rrMax: z.number().optional(),
        mfeMin: z.number().optional(),
        mfeMax: z.number().optional(),
        maeMin: z.number().optional(),
        maeMax: z.number().optional(),
        efficiencyMin: z.number().optional(),
        efficiencyMax: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { accountId, limit } = input;
      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        accountId
      );

      if (scopedAccountIds.length === 0) {
        return { items: [], nextCursor: undefined, totalTradesCount: 0 } as const;
      }

      // Fetch user preferences for advanced metrics
      const userId = ctx.session.user.id;
      const userRows = await db
        .select({ advancedMetricsPreferences: user.advancedMetricsPreferences })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const advancedPrefs = (userRows[0]?.advancedMetricsPreferences as any) || {};
      const disableSampleGating = advancedPrefs.disableSampleGating ?? false;
      const complianceRules =
        scopedAccountIds.length === 1
          ? (advancedPrefs.complianceRulesByAccount as any)?.[accountId] || {}
          : {};

      const whereClauses: any[] = [
        buildAccountScopeCondition(trade.accountId, scopedAccountIds),
      ];

      const holdSecondsExpr =
        sql<number | null>`NULLIF(${trade.tradeDurationSeconds}, '')::numeric`;
      const addNumericRange = (
        expr: any,
        min?: number,
        max?: number
      ) => {
        if (min == null && max == null) return;
        if (min != null && max != null) {
          whereClauses.push(
            sql`${expr} IS NOT NULL AND ${expr} >= ${min} AND ${expr} <= ${max}`
          );
          return;
        }
        if (min != null) {
          whereClauses.push(sql`${expr} IS NOT NULL AND ${expr} >= ${min}`);
          return;
        }
        whereClauses.push(sql`${expr} IS NOT NULL AND ${expr} <= ${max}`);
      };

      const parsedStart = input.startISO ? new Date(input.startISO) : null;
      const parsedEnd = input.endISO ? new Date(input.endISO) : null;
      const start =
        parsedStart && !Number.isNaN(parsedStart.getTime())
          ? new Date(parsedStart)
          : null;
      const end =
        parsedEnd && !Number.isNaN(parsedEnd.getTime())
          ? new Date(parsedEnd)
          : null;

      if (start) start.setUTCHours(0, 0, 0, 0);
      if (end) end.setUTCHours(23, 59, 59, 999);

      const openInWindow =
        start && end
          ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} >= ${start} AND ${trade.openTime} <= ${end}`
          : start
          ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} >= ${start}`
          : end
          ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} <= ${end}`
          : null;

      const closeInWindow =
        start && end
          ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} >= ${start} AND ${trade.closeTime} <= ${end}`
          : start
          ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} >= ${start}`
          : end
          ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} <= ${end}`
          : null;

      const fallbackInWindow =
        start && end
          ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} >= ${start} AND ${trade.createdAt} <= ${end}`
          : start
          ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} >= ${start}`
          : end
          ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} <= ${end}`
          : null;

      if (openInWindow || closeInWindow || fallbackInWindow) {
        const predicates = [openInWindow, closeInWindow, fallbackInWindow].filter(
          Boolean
        );
        whereClauses.push(sql`(${sql.join(predicates as any[], sql` OR `)})`);
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
      if (input.ids && input.ids.length) {
        whereClauses.push(inArray(trade.id, input.ids));
      }
      if (input.symbols && input.symbols.length) {
        // simple OR chain
        const ors = input.symbols.map((s) => eq(trade.symbol, s));
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.killzones && input.killzones.length) {
        // simple OR chain for killzones (legacy support)
        const ors = input.killzones.map((k) => eq(trade.killzone, k));
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.sessionTags && input.sessionTags.length) {
        // Filter by session tags
        const ors = input.sessionTags.map((k) => eq(trade.sessionTag, k));
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.modelTags && input.modelTags.length) {
        // Filter by model tags
        const ors = input.modelTags.map((m) => eq(trade.modelTag, m));
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.protocolAlignment && input.protocolAlignment.length) {
        // Filter by protocol alignment
        const ors = input.protocolAlignment.map((p) =>
          eq(trade.protocolAlignment, p)
        );
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.outcomes && input.outcomes.length) {
        // Filter by outcomes
        const ors = input.outcomes.map((o) => eq(trade.outcome, o));
        whereClauses.push(sql`(${sql.join(ors, sql` OR `)})`);
      }
      if (input.q && input.q.trim()) {
        const q = `%${input.q.trim()}%`;
        whereClauses.push(sql`LOWER(${trade.symbol}) LIKE LOWER(${q})`);
      }

      addNumericRange(holdSecondsExpr, input.holdMin, input.holdMax);
      addNumericRange(trade.volume, input.volumeMin, input.volumeMax);
      addNumericRange(trade.profit, input.profitMin, input.profitMax);
      addNumericRange(
        trade.commissions,
        input.commissionsMin,
        input.commissionsMax
      );
      addNumericRange(trade.swap, input.swapMin, input.swapMax);
      addNumericRange(trade.sl, input.slMin, input.slMax);
      addNumericRange(trade.tp, input.tpMin, input.tpMax);
      addNumericRange(trade.realisedRR, input.rrMin, input.rrMax);
      addNumericRange(trade.mfePips, input.mfeMin, input.mfeMax);
      addNumericRange(trade.maePips, input.maeMin, input.maeMax);
      addNumericRange(
        trade.rrCaptureEfficiency,
        input.efficiencyMin,
        input.efficiencyMax
      );

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
          pipsNum: sql<number | null>`CAST(${trade.pips} AS NUMERIC)`,
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
          entrySpreadPips: sql<number | null>`CAST(${trade.entrySpreadPips} AS NUMERIC)`,
          exitSpreadPips: sql<number | null>`CAST(${trade.exitSpreadPips} AS NUMERIC)`,
          entrySlippagePips: sql<number | null>`CAST(${trade.entrySlippagePips} AS NUMERIC)`,
          exitSlippagePips: sql<number | null>`CAST(${trade.exitSlippagePips} AS NUMERIC)`,
          slModCount: trade.slModCount,
          tpModCount: trade.tpModCount,
          partialCloseCount: trade.partialCloseCount,
          exitDealCount: trade.exitDealCount,
          exitVolume: sql<number | null>`CAST(${trade.exitVolume} AS NUMERIC)`,
          entryDealCount: trade.entryDealCount,
          entryVolume: sql<number | null>`CAST(${trade.entryVolume} AS NUMERIC)`,
          scaleInCount: trade.scaleInCount,
          scaleOutCount: trade.scaleOutCount,
          trailingStopDetected: trade.trailingStopDetected,
          entryPeakDurationSeconds: trade.entryPeakDurationSeconds,
          postExitPeakDurationSeconds: trade.postExitPeakDurationSeconds,
          entryBalance: sql<number | null>`CAST(${trade.entryBalance} AS NUMERIC)`,
          entryEquity: sql<number | null>`CAST(${trade.entryEquity} AS NUMERIC)`,
          entryMargin: sql<number | null>`CAST(${trade.entryMargin} AS NUMERIC)`,
          entryFreeMargin: sql<number | null>`CAST(${trade.entryFreeMargin} AS NUMERIC)`,
          entryMarginLevel: sql<number | null>`CAST(${trade.entryMarginLevel} AS NUMERIC)`,
          alphaWeightedMpe: sql<number | null>`CAST(${trade.alphaWeightedMpe} AS NUMERIC)`,
          // Tag fields (legacy + new)
          sessionTag: trade.sessionTag,
          sessionTagColor: trade.sessionTagColor,
          modelTag: trade.modelTag,
          modelTagColor: trade.modelTagColor,
          protocolAlignment: trade.protocolAlignment,
          beThresholdPips: sql<number | null>`CAST(${trade.beThresholdPips} AS NUMERIC)`,
          // Killzone fields
          killzone: trade.killzone,
          killzoneColor: trade.killzoneColor,
          brokerMeta: trade.brokerMeta,
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
        .where(buildAccountScopeCondition(trade.accountId, scopedAccountIds))
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

        const compliance = evaluateCompliance(
          {
            sl: r.slNum != null ? Number(r.slNum) : null,
            tp: r.tpNum != null ? Number(r.tpNum) : null,
            sessionTag: r.sessionTag || null,
            modelTag: r.modelTag || null,
            entrySpreadPips:
              r.entrySpreadPips != null ? Number(r.entrySpreadPips) : null,
            entrySlippagePips:
              r.entrySlippagePips != null ? Number(r.entrySlippagePips) : null,
            exitSlippagePips:
              r.exitSlippagePips != null ? Number(r.exitSlippagePips) : null,
            plannedRiskPips: advancedMetrics.plannedRiskPips,
            plannedRR: advancedMetrics.plannedRR,
            maePips: advancedMetrics.maePips,
            scaleInCount: r.scaleInCount != null ? Number(r.scaleInCount) : null,
            scaleOutCount:
              r.scaleOutCount != null ? Number(r.scaleOutCount) : null,
            partialCloseCount:
              r.partialCloseCount != null ? Number(r.partialCloseCount) : null,
            holdSeconds,
          },
          complianceRules
        );
        const brokerMeta = getMt5BrokerMeta(r.brokerMeta);

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
          openPrice: r.openPriceNum != null ? Number(r.openPriceNum) : null,
          closePrice: r.closePriceNum != null ? Number(r.closePriceNum) : null,
          pips: r.pipsNum != null ? Number(r.pipsNum) : null,
          commissions: r.commissions != null ? Number(r.commissions) : null,
          swap: r.swap != null ? Number(r.swap) : null,
          createdAtISO: r.createdAt.toISOString(),
          holdSeconds,
          // Tag fields (legacy + new)
          killzone: r.killzone || null,
          killzoneColor: r.killzoneColor || null,
          sessionTag: r.sessionTag || null,
          sessionTagColor: r.sessionTagColor || null,
          modelTag: r.modelTag || null,
          modelTagColor: r.modelTagColor || null,
          protocolAlignment: r.protocolAlignment || null,
          outcome: advancedMetrics.outcome,
          // Intent metrics
          plannedRR: advancedMetrics.plannedRR,
          plannedRiskPips: advancedMetrics.plannedRiskPips,
          plannedTargetPips: advancedMetrics.plannedTargetPips,
          // Opportunity metrics
          manipulationPips: advancedMetrics.manipulationPips,
          mfePips: advancedMetrics.mfePips,
          maePips: advancedMetrics.maePips,
          mpeManipLegR: advancedMetrics.mpeManipLegR,
          mpeManipPE_R: advancedMetrics.mpeManipPE_R,
          maxRR: advancedMetrics.maxRR,
          rawSTDV: advancedMetrics.rawSTDV,
          rawSTDV_PE: advancedMetrics.rawSTDV_PE,
          stdvBucket: advancedMetrics.stdvBucket,
          estimatedWeightedMPE_R: advancedMetrics.estimatedWeightedMPE_R,
          // Execution metrics
          realisedRR: advancedMetrics.realisedRR,
          // Efficiency metrics
          rrCaptureEfficiency: advancedMetrics.rrCaptureEfficiency,
          manipRREfficiency: advancedMetrics.manipRREfficiency,
          exitEfficiency: advancedMetrics.exitEfficiency,
          // Execution quality (EA)
          entrySpreadPips: r.entrySpreadPips != null ? Number(r.entrySpreadPips) : null,
          exitSpreadPips: r.exitSpreadPips != null ? Number(r.exitSpreadPips) : null,
          entrySlippagePips: r.entrySlippagePips != null ? Number(r.entrySlippagePips) : null,
          exitSlippagePips: r.exitSlippagePips != null ? Number(r.exitSlippagePips) : null,
          slModCount: r.slModCount != null ? Number(r.slModCount) : null,
          tpModCount: r.tpModCount != null ? Number(r.tpModCount) : null,
          partialCloseCount: r.partialCloseCount != null ? Number(r.partialCloseCount) : null,
          exitDealCount: r.exitDealCount != null ? Number(r.exitDealCount) : null,
          exitVolume: r.exitVolume != null ? Number(r.exitVolume) : null,
          entryDealCount: r.entryDealCount != null ? Number(r.entryDealCount) : null,
          entryVolume: r.entryVolume != null ? Number(r.entryVolume) : null,
          scaleInCount: r.scaleInCount != null ? Number(r.scaleInCount) : null,
          scaleOutCount: r.scaleOutCount != null ? Number(r.scaleOutCount) : null,
          trailingStopDetected:
            r.trailingStopDetected != null ? Boolean(r.trailingStopDetected) : null,
          entryPeakDurationSeconds:
            r.entryPeakDurationSeconds != null
              ? Number(r.entryPeakDurationSeconds)
              : null,
          postExitPeakDurationSeconds:
            r.postExitPeakDurationSeconds != null
              ? Number(r.postExitPeakDurationSeconds)
              : null,
          entryBalance: r.entryBalance != null ? Number(r.entryBalance) : null,
          entryEquity: r.entryEquity != null ? Number(r.entryEquity) : null,
          entryMargin: r.entryMargin != null ? Number(r.entryMargin) : null,
          entryFreeMargin: r.entryFreeMargin != null ? Number(r.entryFreeMargin) : null,
          entryMarginLevel: r.entryMarginLevel != null ? Number(r.entryMarginLevel) : null,
          brokerMeta,
          closeReason: getMt5BrokerString(brokerMeta, "closeReason"),
          entrySource: getMt5BrokerString(brokerMeta, "entrySource"),
          exitSource: getMt5BrokerString(brokerMeta, "exitSource"),
          executionMode: getMt5BrokerString(brokerMeta, "executionMode"),
          magicNumber: getMt5BrokerNumber(brokerMeta, "magicNumber"),
          complianceStatus: compliance.status,
          complianceFlags: compliance.flags,
        };
      });

      return { items: result, nextCursor, totalTradesCount } as const;
    }),

  // Simple list for widgets that need all trades
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        limit: z.number().min(1).max(500).default(500),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { accountId, limit } = input;
      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        accountId
      );

      if (scopedAccountIds.length === 0) {
        return { trades: [] };
      }

      const whereClauses: any[] = [
        buildAccountScopeCondition(trade.accountId, scopedAccountIds),
        sql`${trade.close} IS NOT NULL`,
      ];

      const parsedStart = input.startISO ? new Date(input.startISO) : null;
      const parsedEnd = input.endISO ? new Date(input.endISO) : null;
      const start =
        parsedStart && !Number.isNaN(parsedStart.getTime())
          ? new Date(parsedStart)
          : null;
      const end =
        parsedEnd && !Number.isNaN(parsedEnd.getTime())
          ? new Date(parsedEnd)
          : null;

      if (start) start.setUTCHours(0, 0, 0, 0);
      if (end) end.setUTCHours(23, 59, 59, 999);

      const openInWindow =
        start && end
          ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} >= ${start} AND ${trade.openTime} <= ${end}`
          : start
          ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} >= ${start}`
          : end
          ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} <= ${end}`
          : null;

      const closeInWindow =
        start && end
          ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} >= ${start} AND ${trade.closeTime} <= ${end}`
          : start
          ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} >= ${start}`
          : end
          ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} <= ${end}`
          : null;

      const fallbackInWindow =
        start && end
          ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} >= ${start} AND ${trade.createdAt} <= ${end}`
          : start
          ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} >= ${start}`
          : end
          ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} <= ${end}`
          : null;

      if (openInWindow || closeInWindow || fallbackInWindow) {
        const predicates = [openInWindow, closeInWindow, fallbackInWindow].filter(
          Boolean
        );
        whereClauses.push(sql`(${sql.join(predicates as any[], sql` OR `)})`);
      }

      const rows = await db
        .select({
          id: trade.id,
          symbol: trade.symbol,
          tradeType: trade.tradeType,
          volume: sql<number>`CAST(${trade.volume} AS NUMERIC)`,
          openPrice: sql<number>`CAST(${trade.openPrice} AS NUMERIC)`,
          closePrice: sql<number>`CAST(${trade.closePrice} AS NUMERIC)`,
          sl: sql<number>`CAST(${trade.sl} AS NUMERIC)`,
          tp: sql<number>`CAST(${trade.tp} AS NUMERIC)`,
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          pips: sql<number>`CAST(${trade.pips} AS NUMERIC)`,
          openTime: trade.openTime,
          closeTime: trade.closeTime,
          sessionTag: trade.sessionTag,
          modelTag: trade.modelTag,
          realisedRR: sql<number>`CAST(${trade.realisedRR} AS NUMERIC)`,
          mfePips: sql<number>`CAST(${trade.mfePips} AS NUMERIC)`,
          maePips: sql<number>`CAST(${trade.maePips} AS NUMERIC)`,
        })
        .from(trade)
        .where(and(...whereClauses))
        .orderBy(desc(trade.createdAt))
        .limit(limit);

      return {
        trades: rows.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          tradeType: t.tradeType,
          volume: Number(t.volume || 0),
          openPrice: t.openPrice != null ? Number(t.openPrice) : null,
          closePrice: t.closePrice != null ? Number(t.closePrice) : null,
          sl: t.sl != null ? Number(t.sl) : null,
          tp: t.tp != null ? Number(t.tp) : null,
          profit: Number(t.profit || 0),
          pips: t.pips != null ? Number(t.pips) : null,
          openTime: t.openTime,
          closeTime: t.closeTime,
          sessionTag: t.sessionTag,
          modelTag: t.modelTag,
          realisedRR: t.realisedRR != null ? Number(t.realisedRR) : null,
          mfePips: t.mfePips != null ? Number(t.mfePips) : null,
          maePips: t.maePips != null ? Number(t.maePips) : null,
        })),
      };
    }),

  listSymbols: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const cacheKey = `${cacheNamespaces.TRADES}:symbols:${input.accountId}`;
      const cached = await enhancedCache.get<string[]>(cacheKey);
      if (cached) return cached;

      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (scopedAccountIds.length === 0) return [];

      const rows = await db
        .select({ symbol: trade.symbol })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, scopedAccountIds));
      const set = new Set<string>();
      for (const r of rows) if (r.symbol) set.add(r.symbol);
      const result = Array.from(set).sort((a, b) => a.localeCompare(b));
      await enhancedCache.set(cacheKey, result, { ttl: CacheTTL.MEDIUM, tags: [cacheNamespaces.TRADES, `account:${input.accountId}`] });
      return result;
    }),
  listKillzones: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (scopedAccountIds.length === 0) return [];

      const rows = await db
        .selectDistinct({
          name: trade.killzone,
          color: sql<string>`COALESCE(${trade.killzoneColor}, '#FF5733')`,
        })
        .from(trade)
        .where(
          and(
            buildAccountScopeCondition(trade.accountId, scopedAccountIds),
            sql`${trade.killzone} IS NOT NULL`
          )
        )
        .orderBy(trade.killzone);
      return rows as { name: string; color: string }[];
    }),

  listSessionTags: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const cacheKey = `${cacheNamespaces.TRADES}:sessionTags:${input.accountId}`;
      const cached = await enhancedCache.get<{ name: string; color: string }[]>(cacheKey);
      if (cached) return cached;

      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (scopedAccountIds.length === 0) return [];

      const rows = await db
        .selectDistinct({
          name: trade.sessionTag,
          color: sql<string>`COALESCE(${trade.sessionTagColor}, '#FF5733')`,
        })
        .from(trade)
        .where(
          and(
            buildAccountScopeCondition(trade.accountId, scopedAccountIds),
            sql`${trade.sessionTag} IS NOT NULL`
          )
        )
        .orderBy(trade.sessionTag);
      const result = rows as { name: string; color: string }[];
      await enhancedCache.set(cacheKey, result, { ttl: CacheTTL.MEDIUM, tags: [cacheNamespaces.TRADES, `account:${input.accountId}`] });
      return result;
    }),

  listModelTags: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const cacheKey = `${cacheNamespaces.TRADES}:modelTags:${input.accountId}`;
      const cached = await enhancedCache.get<{ name: string; color: string }[]>(cacheKey);
      if (cached) return cached;

      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (scopedAccountIds.length === 0) return [];

      const rows = await db
        .selectDistinct({
          name: trade.modelTag,
          color: sql<string>`COALESCE(${trade.modelTagColor}, '#3B82F6')`,
        })
        .from(trade)
        .where(
          and(
            buildAccountScopeCondition(trade.accountId, scopedAccountIds),
            sql`${trade.modelTag} IS NOT NULL`
          )
        )
        .orderBy(trade.modelTag);
      const result = rows as { name: string; color: string }[];
      await enhancedCache.set(cacheKey, result, { ttl: CacheTTL.MEDIUM, tags: [cacheNamespaces.TRADES, `account:${input.accountId}`] });
      return result;
    }),

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
            adversePips: null,
            adverseUsd: null,
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
          return {
            id: r.id,
            adversePips: null,
            adverseUsd: null,
            pctToSL: null,
            hit: "NONE" as const,
            note:
              Number(r.useBrokerData || 0) === 1
                ? "NO_BROKER_PRICE_HISTORY"
                : "NO_PRICE_DATA",
            dataSource:
              Number(r.useBrokerData || 0) === 1
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
            }
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
            }
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
          // Also update sessionTag for consistency
          sessionTag: killzone,
          sessionTagColor: killzoneColor,
        })
        .where(eq(trade.id, tradeId));

      await invalidateTradeScopeCaches([tradeRow[0].accountId]);

      return { success: true };
    }),

  // Update session tag for a trade (new generalized version)
  updateSessionTag: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        sessionTag: z.string().nullable(),
        sessionTagColor: z.union([
          z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          z.null(),
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeId, sessionTag, sessionTagColor } = input;

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

      let canonicalTag = sessionTag;
      if (sessionTag) {
        const existingTagRow = await db
          .select({ sessionTag: trade.sessionTag })
          .from(trade)
          .where(
            and(
              eq(trade.accountId, tradeRow[0].accountId),
              sql`lower(${trade.sessionTag}) = lower(${sessionTag})`
            )
          )
          .limit(1);
        if (existingTagRow.length && existingTagRow[0].sessionTag) {
          canonicalTag = existingTagRow[0].sessionTag;
        }
      }

      // Update the selected trade first.
      await db
        .update(trade)
        .set({
          sessionTag: canonicalTag,
          sessionTagColor,
          killzone: canonicalTag,
          killzoneColor: sessionTagColor,
        })
        .where(eq(trade.id, tradeId));

      if (canonicalTag) {
        // Keep colors consistent for all trades using the same session tag.
        await db
          .update(trade)
          .set({
            sessionTag: canonicalTag,
            sessionTagColor,
            killzone: canonicalTag,
            killzoneColor: sessionTagColor,
          })
          .where(
            and(
              eq(trade.accountId, tradeRow[0].accountId),
              sql`lower(${trade.sessionTag}) = lower(${canonicalTag})`
            )
          );
      }

      await invalidateTradeScopeCaches([tradeRow[0].accountId]);

      return { success: true };
    }),

  backfillDerivedMetrics: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        postExitWindowSeconds: z.number().min(60).max(24 * 3600).default(3600),
        onlyMissing: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accountId, postExitWindowSeconds, onlyMissing } = input;

      const accountRow = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, accountId))
        .limit(1);

      if (!accountRow.length || accountRow[0].userId !== ctx.session.user.id) {
        throw new Error("Unauthorized");
      }

      const manipulation = await updateAccountManipulation(accountId);
      const postExit = await updateAccountPostExitPeaks(
        accountId,
        postExitWindowSeconds,
        onlyMissing
      );

      return {
        success: true,
        manipulation,
        postExit,
      };
    }),

  // Update model tag for a trade
  updateModelTag: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        modelTag: z.string().nullable(),
        modelTagColor: z.union([
          z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          z.null(),
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeId, modelTag, modelTagColor } = input;

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

      // Update the model tag
      await db
        .update(trade)
        .set({
          modelTag,
          modelTagColor,
        })
        .where(eq(trade.id, tradeId));

      await invalidateTradeScopeCaches([tradeRow[0].accountId]);

      return { success: true };
    }),

  // Update protocol alignment for a trade
  updateProtocolAlignment: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        protocolAlignment: z
          .enum(["aligned", "against", "discretionary"])
          .nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeId, protocolAlignment } = input;

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

      // Update the protocol alignment
      await db
        .update(trade)
        .set({
          protocolAlignment,
        })
        .where(eq(trade.id, tradeId));

      return { success: true };
    }),

  // Get sample gate status based on current trade count for an account
  getSampleGateStatus: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { accountId } = input;

      // Verify account ownership
      const accountRow = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, accountId))
        .limit(1);

      if (!accountRow.length || accountRow[0].userId !== ctx.session.user.id) {
        throw new Error("Unauthorized");
      }

      // Get total trade count for this account
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(trade)
        .where(eq(trade.accountId, accountId));

      const tradeCount = Number(result[0]?.count || 0);

      // Import sample gate logic
      const { getSampleGateStatus } = await import("../lib/metric-registry");

      // Fetch user preferences from database
      const userRows = await db
        .select({ advancedMetricsPreferences: user.advancedMetricsPreferences })
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);

      const prefs = (userRows[0]?.advancedMetricsPreferences as any) || {};
      const userPreferences = {
        disableAllGates: prefs.disableSampleGating ?? false,
        minimumSamples: undefined,
      };

      return getSampleGateStatus(tradeCount, userPreferences);
    }),

  // Live Trade Scoring
  scoreOpenTrade: protectedProcedure
    .input(z.object({ tradeId: z.string().min(1), accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify account ownership
      const account = await db
        .select()
        .from(tradingAccount)
        .where(and(eq(tradingAccount.id, input.accountId), eq(tradingAccount.userId, userId)))
        .limit(1);

      if (!account[0]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
      }

      return await scoreOpenTrade(input.tradeId, input.accountId);
    }),

  // Bulk update session tags for multiple trades
  bulkUpdateSessionTags: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        sessionTag: z.string().nullable(),
        sessionTagColor: z.union([
          z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          z.null(),
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeIds, sessionTag, sessionTagColor } = input;

      // Verify all trades belong to the user's accounts
      const trades = await db
        .select({
          id: trade.id,
          accountId: trade.accountId
        })
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      // Get unique account IDs
      const accountIds = [...new Set(trades.map(t => t.accountId))];

      // Verify all accounts belong to the user
      const accounts = await db
        .select({ id: tradingAccount.id, userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const unauthorizedAccounts = accounts.filter(
        acc => acc.userId !== ctx.session.user.id
      );

      if (unauthorizedAccounts.length > 0) {
        throw new Error("Unauthorized");
      }

      // Canonicalize the tag name if provided
      let canonicalTag = sessionTag;
      if (sessionTag) {
        const existingTagRow = await db
          .select({ sessionTag: trade.sessionTag })
          .from(trade)
          .where(
            and(
              inArray(trade.accountId, accountIds),
              sql`lower(${trade.sessionTag}) = lower(${sessionTag})`
            )
          )
          .limit(1);
        if (existingTagRow.length && existingTagRow[0].sessionTag) {
          canonicalTag = existingTagRow[0].sessionTag;
        }
      }

      // Update all selected trades
      await db
        .update(trade)
        .set({
          sessionTag: canonicalTag,
          sessionTagColor,
          killzone: canonicalTag,
          killzoneColor: sessionTagColor,
        })
        .where(inArray(trade.id, tradeIds));

      // If tag exists, update all trades with the same tag to have consistent colors
      if (canonicalTag) {
        for (const accountId of accountIds) {
          await db
            .update(trade)
            .set({
              sessionTag: canonicalTag,
              sessionTagColor,
              killzone: canonicalTag,
              killzoneColor: sessionTagColor,
            })
            .where(
              and(
                eq(trade.accountId, accountId),
                sql`lower(${trade.sessionTag}) = lower(${canonicalTag})`
              )
            );
        }
      }

      await invalidateTradeScopeCaches(accountIds);

      return { success: true, updatedCount: tradeIds.length };
    }),

  // Bulk update model tags for multiple trades
  bulkUpdateModelTags: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        modelTag: z.string().nullable(),
        modelTagColor: z.union([
          z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          z.null(),
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeIds, modelTag, modelTagColor } = input;

      // Verify all trades belong to the user's accounts
      const trades = await db
        .select({
          id: trade.id,
          accountId: trade.accountId
        })
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      // Get unique account IDs
      const accountIds = [...new Set(trades.map(t => t.accountId))];

      // Verify all accounts belong to the user
      const accounts = await db
        .select({ id: tradingAccount.id, userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const unauthorizedAccounts = accounts.filter(
        acc => acc.userId !== ctx.session.user.id
      );

      if (unauthorizedAccounts.length > 0) {
        throw new Error("Unauthorized");
      }

      // Update all selected trades
      await db
        .update(trade)
        .set({
          modelTag,
          modelTagColor,
        })
        .where(inArray(trade.id, tradeIds));

      await invalidateTradeScopeCaches(accountIds);

      return { success: true, updatedCount: tradeIds.length };
    }),

  // Bulk update protocol alignment
  bulkUpdateProtocolAlignment: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        protocolAlignment: z
          .enum(["aligned", "against", "discretionary"])
          .nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeIds, protocolAlignment } = input;

      // Verify all trades belong to the user's accounts
      const trades = await db
        .select({
          id: trade.id,
          accountId: trade.accountId
        })
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      const accountIds = [...new Set(trades.map(t => t.accountId))];

      // Verify all accounts belong to the user
      const accounts = await db
        .select({ id: tradingAccount.id, userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const unauthorizedAccounts = accounts.filter(
        acc => acc.userId !== ctx.session.user.id
      );

      if (unauthorizedAccounts.length > 0) {
        throw new Error("Unauthorized");
      }

      // Update all selected trades
      await db
        .update(trade)
        .set({ protocolAlignment })
        .where(inArray(trade.id, tradeIds));

      return { success: true, updatedCount: tradeIds.length };
    }),

  // Bulk delete trades
  bulkDeleteTrades: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeIds } = input;

      // Verify all trades belong to the user's accounts
      const trades = await db
        .select({
          id: trade.id,
          accountId: trade.accountId
        })
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      const accountIds = [...new Set(trades.map(t => t.accountId))];

      // Verify all accounts belong to the user
      const accounts = await db
        .select({ id: tradingAccount.id, userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const unauthorizedAccounts = accounts.filter(
        acc => acc.userId !== ctx.session.user.id
      );

      if (unauthorizedAccounts.length > 0) {
        throw new Error("Unauthorized");
      }

      // Delete all selected trades
      await db.delete(trade).where(inArray(trade.id, tradeIds));

      await invalidateTradeScopeCaches(accountIds);

      return { success: true, deletedCount: tradeIds.length };
    }),

  // Get aggregate stats for selected trades
  getSelectedTradesStats: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { tradeIds } = input;

      // Verify all trades belong to the user's accounts
      const trades = await db
        .select()
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      const accountIds = [...new Set(trades.map(t => t.accountId))];

      // Verify all accounts belong to the user
      const accounts = await db
        .select({ id: tradingAccount.id, userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const unauthorizedAccounts = accounts.filter(
        acc => acc.userId !== ctx.session.user.id
      );

      if (unauthorizedAccounts.length > 0) {
        throw new Error("Unauthorized");
      }

      // Calculate stats - ensure all values are numbers
      const totalPnL = trades.reduce((sum, t) => sum + Number(t.profit || 0), 0);
      const totalCommissions = trades.reduce((sum, t) => sum + Number(t.commissions || 0), 0);
      const totalSwap = trades.reduce((sum, t) => sum + Number(t.swap || 0), 0);
      const totalVolume = trades.reduce((sum, t) => sum + Number(t.volume || 0), 0);
      const wins = trades.filter(t => Number(t.profit || 0) > 0).length;
      const losses = trades.filter(t => Number(t.profit || 0) < 0).length;
      const breakeven = trades.filter(t => Number(t.profit || 0) === 0).length;
      const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

      // Calculate average RR correctly
      const tradesWithRR = trades.filter(t => t.realisedRR != null && !isNaN(Number(t.realisedRR)));
      const avgRR = tradesWithRR.length > 0
        ? tradesWithRR.reduce((sum, t) => sum + Number(t.realisedRR || 0), 0) / tradesWithRR.length
        : 0;

      const avgHold = trades.length > 0
        ? trades.reduce((sum, t) => sum + Number(t.holdSeconds || 0), 0) / trades.length
        : 0;

      return {
        count: trades.length,
        totalPnL: Number(totalPnL),
        totalCommissions: Number(totalCommissions),
        totalSwap: Number(totalSwap),
        netPnL: Number(totalPnL + totalCommissions + totalSwap),
        totalVolume: Number(totalVolume),
        wins,
        losses,
        breakeven,
        winRate: Number(winRate),
        avgRR: Number(avgRR),
        avgHold: Number(avgHold),
      };
    }),

  // Bulk add notes to trades
  bulkAddNotes: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        note: z.string().min(1),
        appendToExisting: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeIds, note, appendToExisting } = input;

      // Verify all trades belong to the user's accounts
      const trades = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          openText: trade.openText,
        })
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      const accountIds = [...new Set(trades.map(t => t.accountId))];

      // Verify all accounts belong to the user
      const accounts = await db
        .select({ id: tradingAccount.id, userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const unauthorizedAccounts = accounts.filter(
        acc => acc.userId !== ctx.session.user.id
      );

      if (unauthorizedAccounts.length > 0) {
        throw new Error("Unauthorized");
      }

      // Update notes - if appendToExisting, we need to update individually
      if (appendToExisting) {
        for (const t of trades) {
          const existingNote = t.openText || "";
          const newNote = existingNote
            ? `${existingNote}\n\n${note}`
            : note;

          await db
            .update(trade)
            .set({ openText: newNote })
            .where(eq(trade.id, t.id));
        }
      } else {
        await db
          .update(trade)
          .set({ openText: note })
          .where(inArray(trade.id, tradeIds));
      }

      return { success: true, updatedCount: tradeIds.length };
    }),

  // Bulk toggle favorite
  bulkToggleFavorite: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        favorite: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tradeIds, favorite } = input;

      // Verify all trades belong to the user's accounts
      const trades = await db
        .select({
          id: trade.id,
          accountId: trade.accountId
        })
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      const accountIds = [...new Set(trades.map(t => t.accountId))];

      // Verify all accounts belong to the user
      const accounts = await db
        .select({ id: tradingAccount.id, userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const unauthorizedAccounts = accounts.filter(
        acc => acc.userId !== ctx.session.user.id
      );

      if (unauthorizedAccounts.length > 0) {
        throw new Error("Unauthorized");
      }

      // For now, we'll use closeText to store favorite status
      // You might want to add a proper favorite column later
      // Need to fetch current closeText values first
      const tradesWithCloseText = await db
        .select({
          id: trade.id,
          closeText: trade.closeText,
        })
        .from(trade)
        .where(inArray(trade.id, tradeIds));

      // Update each trade individually
      for (const t of tradesWithCloseText) {
        const currentText = t.closeText || '';
        let newText: string;

        if (favorite) {
          // Add [FAVORITE] if not already there
          newText = currentText.includes('[FAVORITE]')
            ? currentText
            : currentText + ' [FAVORITE]';
        } else {
          // Remove [FAVORITE] if present
          newText = currentText.replace(/\s*\[FAVORITE\]\s*/g, '').trim();
        }

        await db
          .update(trade)
          .set({ closeText: newText })
          .where(eq(trade.id, t.id));
      }

      return { success: true, updatedCount: tradeIds.length };
    }),

  // Create a manual trade entry
  create: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      symbol: z.string().min(1).max(20),
      tradeType: z.enum(["long", "short"]),
      volume: z.number().positive(),
      openPrice: z.number().positive(),
      closePrice: z.number().positive(),
      openTime: z.string(), // ISO date string
      closeTime: z.string(), // ISO date string
      sl: z.number().optional(),
      tp: z.number().optional(),
      profit: z.number().optional(), // If not provided, will be calculated
      commissions: z.number().optional(),
      swap: z.number().optional(),
      sessionTag: z.string().optional(),
      modelTag: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify account ownership
      const account = await db
        .select({ id: tradingAccount.id, initialBalance: tradingAccount.initialBalance })
        .from(tradingAccount)
        .where(and(eq(tradingAccount.id, input.accountId), eq(tradingAccount.userId, userId)))
        .limit(1);

      if (!account[0]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
      }

      // Parse timestamps
      const openTime = new Date(input.openTime);
      const closeTime = new Date(input.closeTime);

      if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date format" });
      }

      if (closeTime <= openTime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Close time must be after open time" });
      }

      // Calculate trade duration
      const durationSeconds = Math.floor((closeTime.getTime() - openTime.getTime()) / 1000);

      // Calculate pips and profit if not provided
      const pipSize = getPipSizeForSymbol(input.symbol);
      const isLong = input.tradeType === "long";
      const priceDiff = isLong 
        ? input.closePrice - input.openPrice 
        : input.openPrice - input.closePrice;
      const pips = priceDiff / pipSize;
      
      // Standard lot calculation (simplified - 1 lot = 100,000 units for forex)
      const contractSize = getContractSizeForSymbol(input.symbol);
      const calculatedProfit = priceDiff * input.volume * contractSize;
      const profit = input.profit ?? calculatedProfit;

      // Determine outcome
      let outcome: "Win" | "Loss" | "BE" | "PW";
      const netProfit = profit - (input.commissions || 0) - Math.abs(input.swap || 0);
      if (netProfit > 0) {
        outcome = "Win";
      } else if (netProfit < -0.01) {
        outcome = "Loss";
      } else {
        outcome = "BE";
      }

      // Create the trade
      const tradeId = crypto.randomUUID();
      const [newTrade] = await db
        .insert(trade)
        .values({
          id: tradeId,
          accountId: input.accountId,
          symbol: input.symbol.toUpperCase(),
          tradeType: input.tradeType,
          volume: input.volume.toString(),
          openPrice: input.openPrice.toString(),
          closePrice: input.closePrice.toString(),
          openTime,
          closeTime,
          open: openTime.toISOString(),
          close: closeTime.toISOString(),
          sl: input.sl?.toString() || null,
          tp: input.tp?.toString() || null,
          profit: profit.toString(),
          pips: pips.toString(),
          commissions: input.commissions?.toString() || null,
          swap: input.swap?.toString() || null,
          tradeDurationSeconds: durationSeconds.toString(),
          outcome,
          sessionTag: input.sessionTag || null,
          modelTag: input.modelTag || null,
        })
        .returning();

      // Calculate planned RR if SL and TP provided
      if (input.sl && input.tp) {
        const plannedRiskPips = Math.abs(input.openPrice - input.sl) / pipSize;
        const plannedTargetPips = Math.abs(input.tp - input.openPrice) / pipSize;
        const plannedRR = plannedRiskPips > 0 ? plannedTargetPips / plannedRiskPips : null;

        if (plannedRR !== null) {
          await db
            .update(trade)
            .set({
              plannedRR: plannedRR.toString(),
              plannedRiskPips: plannedRiskPips.toString(),
              plannedTargetPips: plannedTargetPips.toString(),
            })
            .where(eq(trade.id, tradeId));
        }
      }

      return {
        id: newTrade.id,
        symbol: newTrade.symbol,
        profit: parseFloat(newTrade.profit || "0"),
        pips: parseFloat(newTrade.pips || "0"),
        outcome: newTrade.outcome,
      };
    }),

  // Update a trade
  update: protectedProcedure
    .input(z.object({
      tradeId: z.string(),
      symbol: z.string().min(1).max(20).optional(),
      tradeType: z.enum(["long", "short"]).optional(),
      volume: z.number().positive().optional(),
      openPrice: z.number().positive().optional(),
      closePrice: z.number().positive().optional(),
      openTime: z.string().optional(),
      closeTime: z.string().optional(),
      sl: z.number().nullable().optional(),
      tp: z.number().nullable().optional(),
      profit: z.number().optional(),
      commissions: z.number().optional(),
      swap: z.number().optional(),
      sessionTag: z.string().nullable().optional(),
      modelTag: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify ownership through account
      const existing = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
        })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, existing[0].accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      // Build update object
      const updates: Record<string, any> = {};

      if (input.symbol !== undefined) updates.symbol = input.symbol.toUpperCase();
      if (input.tradeType !== undefined) updates.tradeType = input.tradeType;
      if (input.volume !== undefined) updates.volume = input.volume.toString();
      if (input.openPrice !== undefined) updates.openPrice = input.openPrice.toString();
      if (input.closePrice !== undefined) updates.closePrice = input.closePrice.toString();
      if (input.openTime !== undefined) {
        const openTime = new Date(input.openTime);
        updates.openTime = openTime;
        updates.open = openTime.toISOString();
      }
      if (input.closeTime !== undefined) {
        const closeTime = new Date(input.closeTime);
        updates.closeTime = closeTime;
        updates.close = closeTime.toISOString();
      }
      if (input.sl !== undefined) updates.sl = input.sl?.toString() || null;
      if (input.tp !== undefined) updates.tp = input.tp?.toString() || null;
      if (input.profit !== undefined) updates.profit = input.profit.toString();
      if (input.commissions !== undefined) updates.commissions = input.commissions.toString();
      if (input.swap !== undefined) updates.swap = input.swap.toString();
      if (input.sessionTag !== undefined) updates.sessionTag = input.sessionTag;
      if (input.modelTag !== undefined) updates.modelTag = input.modelTag;

      // Recalculate outcome if profit changed
      if (input.profit !== undefined) {
        const netProfit = input.profit - (input.commissions || 0) - Math.abs(input.swap || 0);
        if (netProfit > 0) {
          updates.outcome = "Win";
        } else if (netProfit < -0.01) {
          updates.outcome = "Loss";
        } else {
          updates.outcome = "BE";
        }
      }

      const [updated] = await db
        .update(trade)
        .set(updates)
        .where(eq(trade.id, input.tradeId))
        .returning();

      // Invalidate caches for this account
      if (updated?.accountId) {
        await invalidateTradeScopeCaches([updated.accountId]);
      }

      return updated;
    }),

  // Delete a trade
  delete: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const existing = await db
        .select({ id: trade.id, accountId: trade.accountId })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, existing[0].accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      await db.delete(trade).where(eq(trade.id, input.tradeId));

      // Invalidate caches for this account
      await invalidateTradeScopeCaches([existing[0].accountId]);

      return { ok: true };
    }),
});
