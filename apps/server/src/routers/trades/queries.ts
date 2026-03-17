import { protectedProcedure } from "../../lib/trpc";
import { z } from "zod";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { db } from "../../db";
import { user } from "../../db/schema/auth";
import { trade, tradingAccount } from "../../db/schema/trading";
import {
  calculateAllAdvancedMetrics,
  type TradeData,
} from "../../lib/advanced-metrics";
import {
  buildAccountScopeCondition,
  resolveScopedAccountIds,
} from "../../lib/account-scope";
import { evaluateCompliance } from "../../lib/compliance-audits";
import {
  CacheTTL,
  cacheNamespaces,
  enhancedCache,
} from "../../lib/enhanced-cache";
import { getSampleGateStatus as getTradeSampleGateStatus } from "../../lib/metric-registry";
import {
  createSymbolResolver,
  expandCanonicalSymbolsToRawSymbols,
  listUserSymbolMappings,
  summarizeSymbolGroups,
} from "../../lib/symbol-mapping";
import { scoreOpenTrade as scoreOpenTradeService } from "../../lib/trade-scoring";
import {
  DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
  resolveStoredTradeOutcome,
} from "../../lib/trades/trade-outcome";
import { buildTradeSearchPredicates } from "../../lib/trades/search";
import { tradeDrawdownProcedures } from "./drawdown";
import {
  addNumericRangeClause,
  addTradeDateWindowClauses,
  ensureAccountOwnership,
  getMt5BrokerMeta,
  getMt5BrokerNumber,
  getMt5BrokerString,
  parseNaiveAsUTC,
} from "./shared";

export const tradeQueryProcedures = {
  getById: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ ctx, input }) => {
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
          customTags: trade.customTags,
          entryPeakPrice: sql<
            number | null
          >`CAST(${trade.entryPeakPrice} AS NUMERIC)`,
          postExitPeakPrice: sql<
            number | null
          >`CAST(${trade.postExitPeakPrice} AS NUMERIC)`,
          mfePips: sql<number | null>`CAST(${trade.mfePips} AS NUMERIC)`,
          maePips: sql<number | null>`CAST(${trade.maePips} AS NUMERIC)`,
          realisedRR: sql<number | null>`CAST(${trade.realisedRR} AS NUMERIC)`,
          plannedRR: sql<number | null>`CAST(${trade.plannedRR} AS NUMERIC)`,
          manipulationHigh: sql<
            number | null
          >`CAST(${trade.manipulationHigh} AS NUMERIC)`,
          manipulationLow: sql<
            number | null
          >`CAST(${trade.manipulationLow} AS NUMERIC)`,
          brokerMeta: trade.brokerMeta,
        })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!result[0]) {
        throw new Error("Trade not found");
      }

      await ensureAccountOwnership(ctx.session.user.id, result[0].accountId);
      const userMappings = await listUserSymbolMappings(ctx.session.user.id);
      const resolvedSymbol = createSymbolResolver(userMappings).resolve(
        result[0].symbol
      );

      return {
        ...result[0],
        symbol: result[0].symbol,
        rawSymbol: result[0].symbol,
        symbolGroup: resolvedSymbol.canonicalSymbol,
        brokerMeta: result[0].brokerMeta ?? null,
        openText: getMt5BrokerString(result[0].brokerMeta, "openText"),
        closeText: getMt5BrokerString(result[0].brokerMeta, "closeText"),
        closeReason: getMt5BrokerString(result[0].brokerMeta, "closeReason"),
        entrySource: getMt5BrokerString(result[0].brokerMeta, "entrySource"),
        exitSource: getMt5BrokerString(result[0].brokerMeta, "exitSource"),
        executionMode: getMt5BrokerString(
          result[0].brokerMeta,
          "executionMode"
        ),
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
        customTags: z.array(z.string()).optional(),
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
        return {
          items: [],
          nextCursor: undefined,
          totalTradesCount: 0,
        } as const;
      }

      const userMappings = await listUserSymbolMappings(ctx.session.user.id);
      const symbolResolver = createSymbolResolver(userMappings);

      const userRows = await db
        .select({ advancedMetricsPreferences: user.advancedMetricsPreferences })
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);

      const advancedPrefs =
        (userRows[0]?.advancedMetricsPreferences as any) || {};
      const disableSampleGating = advancedPrefs.disableSampleGating ?? false;
      const complianceRules =
        scopedAccountIds.length === 1
          ? (advancedPrefs.complianceRulesByAccount as any)?.[accountId] || {}
          : {};

      const whereClauses: SQL[] = [
        buildAccountScopeCondition(trade.accountId, scopedAccountIds),
      ];
      const holdSecondsExpr = sql<
        number | null
      >`NULLIF(${trade.tradeDurationSeconds}, '')::numeric`;

      addTradeDateWindowClauses(whereClauses, input.startISO, input.endISO);

      if (input.tradeDirection !== "all") {
        const direction = input.tradeDirection.toLowerCase();
        if (direction === "long" || direction === "buy") {
          whereClauses.push(sql`LOWER(${trade.tradeType}) IN ('long','buy')`);
        } else if (direction === "short" || direction === "sell") {
          whereClauses.push(sql`LOWER(${trade.tradeType}) IN ('short','sell')`);
        }
      }

      if (input.ids?.length) {
        whereClauses.push(inArray(trade.id, input.ids));
      }
      if (input.symbols?.length) {
        const symbolScopeClauses: SQL[] = [
          buildAccountScopeCondition(trade.accountId, scopedAccountIds),
        ];
        addTradeDateWindowClauses(
          symbolScopeClauses,
          input.startISO,
          input.endISO
        );

        const rawSymbolRows = await db
          .selectDistinct({ symbol: trade.symbol })
          .from(trade)
          .where(and(...symbolScopeClauses));
        const matchingRawSymbols = expandCanonicalSymbolsToRawSymbols(
          rawSymbolRows
            .map((row) => row.symbol)
            .filter((value): value is string => Boolean(value)),
          input.symbols,
          userMappings
        );

        if (matchingRawSymbols.length === 0) {
          return {
            items: [],
            nextCursor: undefined,
            totalTradesCount: 0,
          } as const;
        }

        whereClauses.push(inArray(trade.symbol, matchingRawSymbols));
      }
      if (input.killzones?.length) {
        whereClauses.push(
          sql`(${sql.join(
            input.killzones.map((killzone) => eq(trade.killzone, killzone)),
            sql` OR `
          )})`
        );
      }
      if (input.sessionTags?.length) {
        whereClauses.push(
          sql`(${sql.join(
            input.sessionTags.map((tag) => eq(trade.sessionTag, tag)),
            sql` OR `
          )})`
        );
      }
      if (input.modelTags?.length) {
        whereClauses.push(
          sql`(${sql.join(
            input.modelTags.map((tag) => eq(trade.modelTag, tag)),
            sql` OR `
          )})`
        );
      }
      if (input.customTags?.length) {
        whereClauses.push(
          sql`(${sql.join(
            input.customTags.map(
              (tag) =>
                sql`${trade.customTags} @> ${JSON.stringify([tag])}::jsonb`
            ),
            sql` OR `
          )})`
        );
      }
      if (input.protocolAlignment?.length) {
        whereClauses.push(
          sql`(${sql.join(
            input.protocolAlignment.map((value) =>
              eq(trade.protocolAlignment, value)
            ),
            sql` OR `
          )})`
        );
      }
      if (input.outcomes?.length) {
        whereClauses.push(
          sql`(${sql.join(
            input.outcomes.map((value) => eq(trade.outcome, value)),
            sql` OR `
          )})`
        );
      }

      whereClauses.push(...buildTradeSearchPredicates(input.q));

      addNumericRangeClause(
        whereClauses,
        holdSecondsExpr,
        input.holdMin,
        input.holdMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.volume as any,
        input.volumeMin,
        input.volumeMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.profit as any,
        input.profitMin,
        input.profitMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.commissions as any,
        input.commissionsMin,
        input.commissionsMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.swap as any,
        input.swapMin,
        input.swapMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.sl as any,
        input.slMin,
        input.slMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.tp as any,
        input.tpMin,
        input.tpMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.realisedRR as any,
        input.rrMin,
        input.rrMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.mfePips as any,
        input.mfeMin,
        input.mfeMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.maePips as any,
        input.maeMin,
        input.maeMax
      );
      addNumericRangeClause(
        whereClauses,
        trade.rrCaptureEfficiency as any,
        input.efficiencyMin,
        input.efficiencyMax
      );

      if (input.cursor) {
        const cursorDate = new Date(input.cursor.createdAtISO);
        whereClauses.push(
          sql`(${trade.createdAt} < ${cursorDate}) OR ((${trade.createdAt} = ${cursorDate}) AND (${trade.id} < ${input.cursor.id}))`
        );
      }

      const rows = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          ticket: trade.ticket,
          openRaw: sql<string | null>`(${trade.open})`,
          closeRaw: sql<string | null>`(${trade.close})`,
          openTimeRaw: trade.openTime,
          closeTimeRaw: trade.closeTime,
          createdAt: trade.createdAt,
          symbol: trade.symbol,
          tradeType: trade.tradeType,
          volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          slNum: sql<number | null>`CAST(${trade.sl} AS NUMERIC)`,
          tpNum: sql<number | null>`CAST(${trade.tp} AS NUMERIC)`,
          openPriceNum: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
          closePriceNum: sql<
            number | null
          >`CAST(${trade.closePrice} AS NUMERIC)`,
          pipsNum: sql<number | null>`CAST(${trade.pips} AS NUMERIC)`,
          commissions: sql<
            number | null
          >`CAST(${trade.commissions} AS NUMERIC)`,
          swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
          durationSecRaw: sql<string | null>`(${trade.tradeDurationSeconds})`,
          manipulationHigh: sql<
            number | null
          >`CAST(${trade.manipulationHigh} AS NUMERIC)`,
          manipulationLow: sql<
            number | null
          >`CAST(${trade.manipulationLow} AS NUMERIC)`,
          manipulationPips: sql<
            number | null
          >`CAST(${trade.manipulationPips} AS NUMERIC)`,
          entryPeakPrice: sql<
            number | null
          >`CAST(${trade.entryPeakPrice} AS NUMERIC)`,
          postExitPeakPrice: sql<
            number | null
          >`CAST(${trade.postExitPeakPrice} AS NUMERIC)`,
          entrySpreadPips: sql<
            number | null
          >`CAST(${trade.entrySpreadPips} AS NUMERIC)`,
          exitSpreadPips: sql<
            number | null
          >`CAST(${trade.exitSpreadPips} AS NUMERIC)`,
          entrySlippagePips: sql<
            number | null
          >`CAST(${trade.entrySlippagePips} AS NUMERIC)`,
          exitSlippagePips: sql<
            number | null
          >`CAST(${trade.exitSlippagePips} AS NUMERIC)`,
          slModCount: trade.slModCount,
          tpModCount: trade.tpModCount,
          partialCloseCount: trade.partialCloseCount,
          exitDealCount: trade.exitDealCount,
          exitVolume: sql<number | null>`CAST(${trade.exitVolume} AS NUMERIC)`,
          entryDealCount: trade.entryDealCount,
          entryVolume: sql<
            number | null
          >`CAST(${trade.entryVolume} AS NUMERIC)`,
          scaleInCount: trade.scaleInCount,
          scaleOutCount: trade.scaleOutCount,
          trailingStopDetected: trade.trailingStopDetected,
          entryPeakDurationSeconds: trade.entryPeakDurationSeconds,
          postExitPeakDurationSeconds: trade.postExitPeakDurationSeconds,
          entryBalance: sql<
            number | null
          >`CAST(${trade.entryBalance} AS NUMERIC)`,
          entryEquity: sql<
            number | null
          >`CAST(${trade.entryEquity} AS NUMERIC)`,
          entryMargin: sql<
            number | null
          >`CAST(${trade.entryMargin} AS NUMERIC)`,
          entryFreeMargin: sql<
            number | null
          >`CAST(${trade.entryFreeMargin} AS NUMERIC)`,
          entryMarginLevel: sql<
            number | null
          >`CAST(${trade.entryMarginLevel} AS NUMERIC)`,
          alphaWeightedMpe: sql<
            number | null
          >`CAST(${trade.alphaWeightedMpe} AS NUMERIC)`,
          sessionTag: trade.sessionTag,
          sessionTagColor: trade.sessionTagColor,
          modelTag: trade.modelTag,
          modelTagColor: trade.modelTagColor,
          customTags: trade.customTags,
          protocolAlignment: trade.protocolAlignment,
          beThresholdPips: sql<
            number | null
          >`CAST(${trade.beThresholdPips} AS NUMERIC)`,
          killzone: trade.killzone,
          killzoneColor: trade.killzoneColor,
          brokerMeta: trade.brokerMeta,
        })
        .from(trade)
        .where(and(...whereClauses))
        .orderBy(desc(trade.createdAt), desc(trade.id))
        .limit(limit + 1);

      let nextCursor: { createdAtISO: string; id: string } | undefined;
      let items = rows;
      if (rows.length > limit) {
        const last = rows[rows.length - 1];
        nextCursor = {
          createdAtISO: last.createdAt.toISOString(),
          id: last.id,
        };
        items = rows.slice(0, limit);
      }

      const totalTradesCount = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, scopedAccountIds))
        .then((result) => result[0]?.count ?? 0);
      const accountThresholdRows = await db
        .select({
          id: tradingAccount.id,
          breakevenThresholdPips: sql<
            number | null
          >`CAST(${tradingAccount.breakevenThresholdPips} AS NUMERIC)`,
        })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, scopedAccountIds));
      const breakevenThresholdByAccountId = new Map(
        accountThresholdRows.map((row) => [
          row.id,
          row.breakevenThresholdPips ?? DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
        ])
      );

      const result = items.map((row) => {
        const resolvedSymbol = symbolResolver.resolve(row.symbol);
        const direction: "long" | "short" =
          String(row.tradeType || "").toLowerCase() === "short" ||
          String(row.tradeType || "").toLowerCase() === "sell"
            ? "short"
            : "long";
        const openISO = (
          row.openTimeRaw ||
          parseNaiveAsUTC(row.openRaw) ||
          row.createdAt
        ).toISOString();
        const closeISO = (
          row.closeTimeRaw ||
          parseNaiveAsUTC(row.closeRaw) ||
          row.createdAt
        ).toISOString();
        const parsedDuration = row.durationSecRaw
          ? Number(row.durationSecRaw)
          : Number.NaN;
        const holdSeconds = Number.isFinite(parsedDuration)
          ? Math.max(0, Math.floor(parsedDuration))
          : Math.max(
              0,
              Math.floor(
                (new Date(closeISO).getTime() - new Date(openISO).getTime()) /
                  1000
              )
            );

        const tradeData: TradeData = {
          id: row.id,
          symbol: resolvedSymbol.canonicalSymbol,
          tradeDirection: direction,
          entryPrice: Number(row.openPriceNum || 0),
          sl: row.slNum != null ? Number(row.slNum) : null,
          tp: row.tpNum != null ? Number(row.tpNum) : null,
          closePrice:
            row.closePriceNum != null ? Number(row.closePriceNum) : null,
          profit: Number(row.profit || 0),
          commissions: row.commissions != null ? Number(row.commissions) : null,
          swap: row.swap != null ? Number(row.swap) : null,
          volume: Number(row.volume || 0),
          manipulationHigh:
            row.manipulationHigh != null ? Number(row.manipulationHigh) : null,
          manipulationLow:
            row.manipulationLow != null ? Number(row.manipulationLow) : null,
          manipulationPips:
            row.manipulationPips != null ? Number(row.manipulationPips) : null,
          entryPeakPrice:
            row.entryPeakPrice != null ? Number(row.entryPeakPrice) : null,
          postExitPeakPrice:
            row.postExitPeakPrice != null
              ? Number(row.postExitPeakPrice)
              : null,
          alphaWeightedMpe:
            row.alphaWeightedMpe != null ? Number(row.alphaWeightedMpe) : 0.3,
          beThresholdPips:
            row.beThresholdPips != null
              ? Number(row.beThresholdPips)
              : breakevenThresholdByAccountId.get(row.accountId) ??
                DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
        };

        const advancedMetrics = calculateAllAdvancedMetrics(
          tradeData,
          totalTradesCount,
          disableSampleGating
        );

        const compliance = evaluateCompliance(
          {
            sl: row.slNum != null ? Number(row.slNum) : null,
            tp: row.tpNum != null ? Number(row.tpNum) : null,
            sessionTag: row.sessionTag || null,
            modelTag: row.modelTag || null,
            entrySpreadPips:
              row.entrySpreadPips != null ? Number(row.entrySpreadPips) : null,
            entrySlippagePips:
              row.entrySlippagePips != null
                ? Number(row.entrySlippagePips)
                : null,
            exitSlippagePips:
              row.exitSlippagePips != null
                ? Number(row.exitSlippagePips)
                : null,
            plannedRiskPips: advancedMetrics.plannedRiskPips,
            plannedRR: advancedMetrics.plannedRR,
            maePips: advancedMetrics.maePips,
            scaleInCount:
              row.scaleInCount != null ? Number(row.scaleInCount) : null,
            scaleOutCount:
              row.scaleOutCount != null ? Number(row.scaleOutCount) : null,
            partialCloseCount:
              row.partialCloseCount != null
                ? Number(row.partialCloseCount)
                : null,
            holdSeconds,
          },
          complianceRules
        );
        const brokerMeta = getMt5BrokerMeta(row.brokerMeta);

        return {
          id: row.id,
          accountId: row.accountId,
          ticket: row.ticket || null,
          open: openISO,
          close: closeISO,
          symbol: row.symbol || "",
          rawSymbol: row.symbol || "",
          symbolGroup: resolvedSymbol.canonicalSymbol,
          tradeDirection: direction,
          volume: Number(row.volume || 0),
          profit: Number(row.profit || 0),
          sl: row.slNum != null ? Number(row.slNum) : null,
          tp: row.tpNum != null ? Number(row.tpNum) : null,
          openPrice: row.openPriceNum != null ? Number(row.openPriceNum) : null,
          closePrice:
            row.closePriceNum != null ? Number(row.closePriceNum) : null,
          pips: row.pipsNum != null ? Number(row.pipsNum) : null,
          commissions: row.commissions != null ? Number(row.commissions) : null,
          swap: row.swap != null ? Number(row.swap) : null,
          createdAtISO: row.createdAt.toISOString(),
          holdSeconds,
          killzone: row.killzone || null,
          killzoneColor: row.killzoneColor || null,
          sessionTag: row.sessionTag || null,
          sessionTagColor: row.sessionTagColor || null,
          modelTag: row.modelTag || null,
          modelTagColor: row.modelTagColor || null,
          customTags: Array.isArray(row.customTags) ? row.customTags : [],
          protocolAlignment: row.protocolAlignment || null,
          outcome: advancedMetrics.outcome,
          plannedRR: advancedMetrics.plannedRR,
          plannedRiskPips: advancedMetrics.plannedRiskPips,
          plannedTargetPips: advancedMetrics.plannedTargetPips,
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
          realisedRR: advancedMetrics.realisedRR,
          rrCaptureEfficiency: advancedMetrics.rrCaptureEfficiency,
          manipRREfficiency: advancedMetrics.manipRREfficiency,
          exitEfficiency: advancedMetrics.exitEfficiency,
          entrySpreadPips:
            row.entrySpreadPips != null ? Number(row.entrySpreadPips) : null,
          exitSpreadPips:
            row.exitSpreadPips != null ? Number(row.exitSpreadPips) : null,
          entrySlippagePips:
            row.entrySlippagePips != null
              ? Number(row.entrySlippagePips)
              : null,
          exitSlippagePips:
            row.exitSlippagePips != null ? Number(row.exitSlippagePips) : null,
          slModCount: row.slModCount != null ? Number(row.slModCount) : null,
          tpModCount: row.tpModCount != null ? Number(row.tpModCount) : null,
          partialCloseCount:
            row.partialCloseCount != null
              ? Number(row.partialCloseCount)
              : null,
          exitDealCount:
            row.exitDealCount != null ? Number(row.exitDealCount) : null,
          exitVolume: row.exitVolume != null ? Number(row.exitVolume) : null,
          entryDealCount:
            row.entryDealCount != null ? Number(row.entryDealCount) : null,
          entryVolume: row.entryVolume != null ? Number(row.entryVolume) : null,
          scaleInCount:
            row.scaleInCount != null ? Number(row.scaleInCount) : null,
          scaleOutCount:
            row.scaleOutCount != null ? Number(row.scaleOutCount) : null,
          trailingStopDetected:
            row.trailingStopDetected != null
              ? Boolean(row.trailingStopDetected)
              : null,
          entryPeakDurationSeconds:
            row.entryPeakDurationSeconds != null
              ? Number(row.entryPeakDurationSeconds)
              : null,
          postExitPeakDurationSeconds:
            row.postExitPeakDurationSeconds != null
              ? Number(row.postExitPeakDurationSeconds)
              : null,
          entryBalance:
            row.entryBalance != null ? Number(row.entryBalance) : null,
          entryEquity: row.entryEquity != null ? Number(row.entryEquity) : null,
          entryMargin: row.entryMargin != null ? Number(row.entryMargin) : null,
          entryFreeMargin:
            row.entryFreeMargin != null ? Number(row.entryFreeMargin) : null,
          entryMarginLevel:
            row.entryMarginLevel != null ? Number(row.entryMarginLevel) : null,
          brokerMeta,
          openText: getMt5BrokerString(brokerMeta, "openText"),
          closeText: getMt5BrokerString(brokerMeta, "closeText"),
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
      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );

      if (scopedAccountIds.length === 0) {
        return { trades: [] };
      }

      const userMappings = await listUserSymbolMappings(ctx.session.user.id);
      const symbolResolver = createSymbolResolver(userMappings);

      const whereClauses: SQL[] = [
        buildAccountScopeCondition(trade.accountId, scopedAccountIds),
        sql`${trade.close} IS NOT NULL`,
      ];

      addTradeDateWindowClauses(whereClauses, input.startISO, input.endISO);

      const rows = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
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
          customTags: trade.customTags,
          realisedRR: sql<number>`CAST(${trade.realisedRR} AS NUMERIC)`,
          mfePips: sql<number>`CAST(${trade.mfePips} AS NUMERIC)`,
          maePips: sql<number>`CAST(${trade.maePips} AS NUMERIC)`,
        })
        .from(trade)
        .where(and(...whereClauses))
        .orderBy(desc(trade.createdAt))
        .limit(input.limit);

      return {
        trades: rows.map((currentTrade) => ({
          ...(() => {
            const resolvedSymbol = symbolResolver.resolve(currentTrade.symbol);
            return {
              symbol: currentTrade.symbol,
              rawSymbol: currentTrade.symbol,
              symbolGroup: resolvedSymbol.canonicalSymbol,
            };
          })(),
          id: currentTrade.id,
          accountId: currentTrade.accountId,
          tradeType: currentTrade.tradeType,
          volume: Number(currentTrade.volume || 0),
          openPrice:
            currentTrade.openPrice != null
              ? Number(currentTrade.openPrice)
              : null,
          closePrice:
            currentTrade.closePrice != null
              ? Number(currentTrade.closePrice)
              : null,
          sl: currentTrade.sl != null ? Number(currentTrade.sl) : null,
          tp: currentTrade.tp != null ? Number(currentTrade.tp) : null,
          profit: Number(currentTrade.profit || 0),
          pips: currentTrade.pips != null ? Number(currentTrade.pips) : null,
          openTime: currentTrade.openTime,
          closeTime: currentTrade.closeTime,
          sessionTag: currentTrade.sessionTag,
          modelTag: currentTrade.modelTag,
          customTags: Array.isArray(currentTrade.customTags)
            ? currentTrade.customTags
            : [],
          realisedRR:
            currentTrade.realisedRR != null
              ? Number(currentTrade.realisedRR)
              : null,
          mfePips:
            currentTrade.mfePips != null ? Number(currentTrade.mfePips) : null,
          maePips:
            currentTrade.maePips != null ? Number(currentTrade.maePips) : null,
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
      const userMappings = await listUserSymbolMappings(ctx.session.user.id);

      const rows = await db
        .select({ symbol: trade.symbol })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, scopedAccountIds));
      const groupedSymbols = summarizeSymbolGroups(
        rows
          .map((row) => row.symbol)
          .filter((value): value is string => Boolean(value)),
        userMappings
      );
      const result = groupedSymbols
        .map((group) => group.displaySymbol)
        .sort((a, b) => a.localeCompare(b));
      await enhancedCache.set(cacheKey, result, {
        ttl: CacheTTL.MEDIUM,
        tags: [cacheNamespaces.TRADES, `account:${input.accountId}`],
      });
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
      const cached = await enhancedCache.get<{ name: string; color: string }[]>(
        cacheKey
      );
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
      await enhancedCache.set(cacheKey, result, {
        ttl: CacheTTL.MEDIUM,
        tags: [cacheNamespaces.TRADES, `account:${input.accountId}`],
      });
      return result;
    }),

  listModelTags: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const cacheKey = `${cacheNamespaces.TRADES}:modelTags:${input.accountId}`;
      const cached = await enhancedCache.get<{ name: string; color: string }[]>(
        cacheKey
      );
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
      await enhancedCache.set(cacheKey, result, {
        ttl: CacheTTL.MEDIUM,
        tags: [cacheNamespaces.TRADES, `account:${input.accountId}`],
      });
      return result;
    }),
  listCustomTags: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const cacheKey = `${cacheNamespaces.TRADES}:customTags:${input.accountId}`;
      const cached = await enhancedCache.get<string[]>(cacheKey);
      if (cached) return cached;

      const scopedAccountIds = await resolveScopedAccountIds(
        ctx.session.user.id,
        input.accountId
      );
      if (scopedAccountIds.length === 0) return [];

      const rows = await db
        .select({ customTags: trade.customTags })
        .from(trade)
        .where(buildAccountScopeCondition(trade.accountId, scopedAccountIds));

      const result = Array.from(
        new Set(
          rows.flatMap((row) =>
            Array.isArray(row.customTags)
              ? row.customTags.filter(
                  (tag): tag is string =>
                    typeof tag === "string" && tag.length > 0
                )
              : []
          )
        )
      ).sort((left, right) => left.localeCompare(right));

      await enhancedCache.set(cacheKey, result, {
        ttl: CacheTTL.MEDIUM,
        tags: [cacheNamespaces.TRADES, `account:${input.accountId}`],
      });
      return result;
    }),

  getSampleGateStatus: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureAccountOwnership(ctx.session.user.id, input.accountId);

      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(trade)
        .where(eq(trade.accountId, input.accountId));

      const tradeCount = Number(result[0]?.count || 0);
      const userRows = await db
        .select({ advancedMetricsPreferences: user.advancedMetricsPreferences })
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);

      const prefs = (userRows[0]?.advancedMetricsPreferences as any) || {};
      return getTradeSampleGateStatus(tradeCount, {
        disableAllGates: prefs.disableSampleGating ?? false,
        minimumSamples: undefined,
      });
    }),

  scoreOpenTrade: protectedProcedure
    .input(
      z.object({ tradeId: z.string().min(1), accountId: z.string().min(1) })
    )
    .query(async ({ input, ctx }) => {
      await ensureAccountOwnership(ctx.session.user.id, input.accountId);
      return scoreOpenTradeService(input.tradeId, input.accountId);
    }),

  getSelectedTradesStats: protectedProcedure
    .input(z.object({ tradeIds: z.array(z.string().min(1)).min(1) }))
    .query(async ({ input, ctx }) => {
      const trades = await db
        .select()
        .from(trade)
        .where(inArray(trade.id, input.tradeIds));

      if (trades.length === 0) {
        throw new Error("No trades found");
      }

      const accountIds = [...new Set(trades.map((row) => row.accountId))];
      const accounts = await db
        .select({
          id: tradingAccount.id,
          userId: tradingAccount.userId,
          breakevenThresholdPips: tradingAccount.breakevenThresholdPips,
        })
        .from(tradingAccount)
        .where(inArray(tradingAccount.id, accountIds));

      const isMissingAccount = accounts.length !== accountIds.length;
      const isUnauthorized = accounts.some(
        (account) => account.userId !== ctx.session.user.id
      );
      if (isMissingAccount || isUnauthorized) {
        throw new Error("Unauthorized");
      }

      const totalPnL = trades.reduce(
        (sum, row) => sum + Number(row.profit || 0),
        0
      );
      const totalCommissions = trades.reduce(
        (sum, row) => sum + Number(row.commissions || 0),
        0
      );
      const totalSwap = trades.reduce(
        (sum, row) => sum + Number(row.swap || 0),
        0
      );
      const totalVolume = trades.reduce(
        (sum, row) => sum + Number(row.volume || 0),
        0
      );
      const thresholdByAccountId = new Map(
        accounts.map((account) => [
          account.id,
          account.breakevenThresholdPips != null
            ? Number(account.breakevenThresholdPips)
            : DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
        ])
      );
      const resolvedOutcomes = trades.map((row) =>
        resolveStoredTradeOutcome({
          outcome: row.outcome,
          symbol: row.symbol,
          profit: row.profit,
          commissions: row.commissions,
          swap: row.swap,
          tp: row.tp,
          closePrice: row.closePrice,
          openPrice: row.openPrice,
          tradeType: row.tradeType,
          beThresholdPips:
            row.beThresholdPips ??
            thresholdByAccountId.get(row.accountId) ??
            DEFAULT_BREAKEVEN_THRESHOLD_PIPS,
        })
      );
      const wins = resolvedOutcomes.filter(
        (outcome) => outcome === "Win" || outcome === "PW"
      ).length;
      const losses = resolvedOutcomes.filter(
        (outcome) => outcome === "Loss"
      ).length;
      const breakeven = resolvedOutcomes.filter(
        (outcome) => outcome === "BE"
      ).length;
      const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
      const tradesWithRR = trades.filter(
        (row) => row.realisedRR != null && !Number.isNaN(Number(row.realisedRR))
      );
      const avgRR =
        tradesWithRR.length > 0
          ? tradesWithRR.reduce(
              (sum, row) => sum + Number(row.realisedRR || 0),
              0
            ) / tradesWithRR.length
          : 0;
      const avgHold =
        trades.length > 0
          ? trades.reduce(
              (sum, row) => sum + Number(row.tradeDurationSeconds || 0),
              0
            ) / trades.length
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

  ...tradeDrawdownProcedures,
};
