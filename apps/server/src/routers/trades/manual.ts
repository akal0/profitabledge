import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { openTrade, trade } from "../../db/schema/trading";
import { notifyEarnedAchievements } from "../../lib/achievements";
import { protectedProcedure } from "../../lib/trpc";
import { enrichManualTradeFromPriceHistory } from "../../lib/trades/manual/enrichment";
import {
  buildManualClosedTradeInsert,
  buildManualOpenTradeInsert,
  deriveClosedTradeProfit,
  MANUAL_OPEN_TICKET_PREFIX,
  parseManualTradeDate,
} from "../../lib/trades/manual/derive";
import { findManualTradeReconciliationCandidates } from "../../lib/trades/manual/reconciliation";
import { normalizeTradeTags } from "../../lib/trades/tags";
import {
  ensureAccountOwnership,
  ensureOpenTradeOwnership,
  invalidateTradeScopeCaches,
} from "./shared";
import { syncPropAccountState } from "../../lib/prop-rule-monitor";

const manualCommonInputSchema = z.object({
  accountId: z.string().min(1),
  symbol: z.string().trim().min(1).max(64),
  tradeType: z.enum(["long", "short"]),
  volume: z.number().positive(),
  openPrice: z.number().positive(),
  openTime: z.string().min(1),
  sl: z.number().positive().nullable().optional(),
  tp: z.number().positive().nullable().optional(),
  commissions: z.number().finite().nullable().optional(),
  swap: z.number().finite().nullable().optional(),
  sessionTag: z.string().trim().max(80).nullable().optional(),
  modelTag: z.string().trim().max(80).nullable().optional(),
  customTags: z.array(z.string().trim().min(1)).max(50).optional(),
});

const manualClosedTradeSchema = manualCommonInputSchema.extend({
  closePrice: z.number().positive().nullable().optional(),
  closeTime: z.string().min(1),
  profit: z.number().finite().nullable().optional(),
});

const manualOpenTradeSchema = manualCommonInputSchema.extend({
  currentPrice: z.number().positive().nullable().optional(),
  profit: z.number().finite().nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

export const tradeManualProcedures = {
  createManualClosedTrade: protectedProcedure
    .input(manualClosedTradeSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await ensureAccountOwnership(
        ctx.session.user.id,
        input.accountId
      );
      const tradeId = crypto.randomUUID();
      const prepared = buildManualClosedTradeInsert({
        tradeId,
        account,
        values: input,
      });

      const [createdTrade] = await db
        .insert(trade)
        .values(prepared.insertValues)
        .returning({
          id: trade.id,
          symbol: trade.symbol,
          profit: trade.profit,
          outcome: trade.outcome,
        });

      const enrichment = await enrichManualTradeFromPriceHistory({
        tradeId,
        accountId: input.accountId,
      });

      const reconciliationCandidates =
        await findManualTradeReconciliationCandidates({
          accountId: input.accountId,
          tradeId,
          symbol: prepared.summary.symbol,
          tradeType: input.tradeType,
          volume: input.volume,
          openPrice: input.openPrice,
          closePrice: prepared.summary.closePrice,
          openTime: prepared.summary.openTime,
          closeTime: prepared.summary.closeTime,
        });

      await invalidateTradeScopeCaches([input.accountId]);
      await syncPropAccountState(input.accountId, { saveAlerts: true });
      void notifyEarnedAchievements({
        userId: ctx.session.user.id,
        accountId: input.accountId,
        source: "manual-trade",
      }).catch((error) => {
        console.error("[ManualTrades] Achievement notification failed:", error);
      });

      return {
        id: createdTrade.id,
        symbol: createdTrade.symbol,
        profit: Number(createdTrade.profit || 0),
        outcome: createdTrade.outcome,
        enrichment,
        reconciliationCandidates,
        derivedProfit: prepared.summary.derivedProfit,
        derivedClosePrice: prepared.summary.derivedClosePrice,
      };
    }),

  createManualOpenTrade: protectedProcedure
    .input(manualOpenTradeSchema)
    .mutation(async ({ ctx, input }) => {
      await ensureAccountOwnership(ctx.session.user.id, input.accountId);
      const openTradeId = crypto.randomUUID();
      const prepared = buildManualOpenTradeInsert({
        openTradeId,
        values: {
          ...input,
          customTags: normalizeTradeTags(input.customTags),
        },
      });

      const [createdOpenTrade] = await db
        .insert(openTrade)
        .values(prepared.insertValues)
        .returning({
          id: openTrade.id,
          symbol: openTrade.symbol,
          profit: openTrade.profit,
          ticket: openTrade.ticket,
        });

      await invalidateTradeScopeCaches([input.accountId]);
      await syncPropAccountState(input.accountId, { saveAlerts: true });

      return {
        id: createdOpenTrade.id,
        symbol: createdOpenTrade.symbol,
        profit: Number(createdOpenTrade.profit || 0),
        ticket: createdOpenTrade.ticket,
        derivedFloatingProfit: prepared.summary.derivedFloatingProfit,
      };
    }),

  closeManualOpenTrade: protectedProcedure
    .input(
      z.object({
        openTradeId: z.string().min(1),
        symbol: z.string().trim().min(1).max(64).optional(),
        tradeType: z.enum(["long", "short"]).optional(),
        volume: z.number().positive().optional(),
        openPrice: z.number().positive().optional(),
        openTime: z.string().optional(),
        sl: z.number().positive().nullable().optional(),
        tp: z.number().positive().nullable().optional(),
        sessionTag: z.string().trim().max(80).nullable().optional(),
        modelTag: z.string().trim().max(80).nullable().optional(),
        customTags: z.array(z.string().trim().min(1)).max(50).optional(),
        closePrice: z.number().positive().nullable().optional(),
        closeTime: z.string().optional(),
        profit: z.number().finite().nullable().optional(),
        commissions: z.number().finite().nullable().optional(),
        swap: z.number().finite().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedOpenTrade = await ensureOpenTradeOwnership(
        ctx.session.user.id,
        input.openTradeId
      );

      const [currentOpenTrade] = await db
        .select()
        .from(openTrade)
        .where(eq(openTrade.id, input.openTradeId))
        .limit(1);

      if (!currentOpenTrade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Open trade not found",
        });
      }

      const account = await ensureAccountOwnership(
        ctx.session.user.id,
        currentOpenTrade.accountId
      );
      const brokerMeta =
        currentOpenTrade.brokerMeta &&
        typeof currentOpenTrade.brokerMeta === "object" &&
        !Array.isArray(currentOpenTrade.brokerMeta)
          ? (currentOpenTrade.brokerMeta as Record<string, unknown>)
          : {};
      const closeTime = parseManualTradeDate(
        input.closeTime ?? new Date().toISOString(),
        "Close time"
      );
      const currentPrice =
        input.closePrice ??
        (currentOpenTrade.currentPrice != null
          ? Number(currentOpenTrade.currentPrice)
          : null);

      const fallbackProfit =
        currentPrice == null
          ? null
          : deriveClosedTradeProfit({
              tradeType:
                currentOpenTrade.tradeType === "short" ? "short" : "long",
              openPrice: Number(currentOpenTrade.openPrice),
              closePrice: currentPrice,
              volume: Number(currentOpenTrade.volume),
              symbol: currentOpenTrade.symbol,
            });

      const tradeId = crypto.randomUUID();
      const prepared = buildManualClosedTradeInsert({
        tradeId,
        account,
        values: {
          accountId: currentOpenTrade.accountId,
          symbol: input.symbol ?? currentOpenTrade.symbol,
          tradeType:
            input.tradeType ??
            (currentOpenTrade.tradeType === "short" ? "short" : "long"),
          volume: input.volume ?? Number(currentOpenTrade.volume),
          openPrice: input.openPrice ?? Number(currentOpenTrade.openPrice),
          openTime: input.openTime ?? currentOpenTrade.openTime,
          sl:
            input.sl !== undefined
              ? input.sl
              : currentOpenTrade.sl != null
              ? Number(currentOpenTrade.sl)
              : null,
          tp:
            input.tp !== undefined
              ? input.tp
              : currentOpenTrade.tp != null
              ? Number(currentOpenTrade.tp)
              : null,
          commissions:
            input.commissions ??
            (currentOpenTrade.commission != null
              ? Number(currentOpenTrade.commission)
              : null),
          swap:
            input.swap ??
            (currentOpenTrade.swap != null
              ? Number(currentOpenTrade.swap)
              : null),
          sessionTag:
            input.sessionTag !== undefined
              ? input.sessionTag
              : currentOpenTrade.sessionTag,
          modelTag:
            input.modelTag !== undefined
              ? input.modelTag
              : typeof brokerMeta.manualModelTag === "string"
              ? brokerMeta.manualModelTag
              : null,
          customTags:
            input.customTags ??
            (Array.isArray(brokerMeta.manualCustomTags)
              ? brokerMeta.manualCustomTags.filter(
                  (tag): tag is string => typeof tag === "string"
                )
              : []),
          closePrice: currentPrice,
          closeTime,
          profit: input.profit ?? fallbackProfit,
        },
      });

      const [createdTrade] = await db
        .insert(trade)
        .values({
          ...prepared.insertValues,
          ticket:
            currentOpenTrade.ticket ??
            `${MANUAL_OPEN_TICKET_PREFIX}${tradeId}`,
          brokerMeta: {
            ...(currentOpenTrade.brokerMeta as Record<string, unknown> | null),
            manualEntry: true,
            manualMode: "closed",
            closedFromOpenTradeId: currentOpenTrade.id,
          },
        })
        .returning({
          id: trade.id,
          symbol: trade.symbol,
          profit: trade.profit,
          outcome: trade.outcome,
        });

      await db.delete(openTrade).where(eq(openTrade.id, currentOpenTrade.id));

      const enrichment = await enrichManualTradeFromPriceHistory({
        tradeId,
        accountId: currentOpenTrade.accountId,
      });

      const reconciliationCandidates =
        await findManualTradeReconciliationCandidates({
          accountId: currentOpenTrade.accountId,
          tradeId,
          symbol: prepared.summary.symbol,
          tradeType:
            currentOpenTrade.tradeType === "short" ? "short" : "long",
          volume: Number(currentOpenTrade.volume),
          openPrice: Number(currentOpenTrade.openPrice),
          closePrice: prepared.summary.closePrice,
          openTime: prepared.summary.openTime,
          closeTime: prepared.summary.closeTime,
        });

      await invalidateTradeScopeCaches([ownedOpenTrade.accountId]);
      await syncPropAccountState(ownedOpenTrade.accountId, {
        saveAlerts: true,
      });
      void notifyEarnedAchievements({
        userId: ctx.session.user.id,
        accountId: ownedOpenTrade.accountId,
        source: "manual-trade",
      }).catch((error) => {
        console.error("[ManualTrades] Achievement notification failed:", error);
      });

      return {
        id: createdTrade.id,
        symbol: createdTrade.symbol,
        profit: Number(createdTrade.profit || 0),
        outcome: createdTrade.outcome,
        enrichment,
        reconciliationCandidates,
      };
    }),

  bulkCreateManualTrades: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        trades: z.array(manualClosedTradeSchema).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAccountOwnership(ctx.session.user.id, input.accountId);

      const created: Array<{
        id: string;
        symbol: string;
        profit: number;
        reconciliationCandidates: Awaited<
          ReturnType<typeof findManualTradeReconciliationCandidates>
        >;
      }> = [];

      for (const tradeInput of input.trades) {
        const account = await ensureAccountOwnership(
          ctx.session.user.id,
          tradeInput.accountId
        );
        const tradeId = crypto.randomUUID();
        const prepared = buildManualClosedTradeInsert({
          tradeId,
          account,
          values: tradeInput,
        });

        await db.insert(trade).values(prepared.insertValues);
        void enrichManualTradeFromPriceHistory({
          tradeId,
          accountId: tradeInput.accountId,
        });
        const reconciliationCandidates =
          await findManualTradeReconciliationCandidates({
            accountId: tradeInput.accountId,
            tradeId,
            symbol: prepared.summary.symbol,
            tradeType: tradeInput.tradeType,
            volume: tradeInput.volume,
            openPrice: tradeInput.openPrice,
            closePrice: prepared.summary.closePrice,
            openTime: prepared.summary.openTime,
            closeTime: prepared.summary.closeTime,
          });

        created.push({
          id: tradeId,
          symbol: prepared.summary.symbol,
          profit: prepared.summary.profit,
          reconciliationCandidates,
        });
      }

      await invalidateTradeScopeCaches([input.accountId]);
      await syncPropAccountState(input.accountId, { saveAlerts: true });
      void notifyEarnedAchievements({
        userId: ctx.session.user.id,
        accountId: input.accountId,
        source: "manual-trade",
      }).catch((error) => {
        console.error("[ManualTrades] Achievement notification failed:", error);
      });

      return {
        success: true,
        createdCount: created.length,
        created,
        matchedCount: created.filter(
          (row) => row.reconciliationCandidates.length > 0
        ).length,
      };
    }),

  listManualOpenTrades: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await ensureAccountOwnership(ctx.session.user.id, input.accountId);

      const rows = await db
        .select({
          id: openTrade.id,
          ticket: openTrade.ticket,
          symbol: openTrade.symbol,
          tradeType: openTrade.tradeType,
          volume: openTrade.volume,
          openPrice: openTrade.openPrice,
          currentPrice: openTrade.currentPrice,
          profit: openTrade.profit,
          commission: openTrade.commission,
          swap: openTrade.swap,
          openTime: openTrade.openTime,
          sl: openTrade.sl,
          tp: openTrade.tp,
          sessionTag: openTrade.sessionTag,
          comment: openTrade.comment,
          brokerMeta: openTrade.brokerMeta,
        })
        .from(openTrade)
        .where(
          and(
            eq(openTrade.accountId, input.accountId),
            sql`(${openTrade.ticket} LIKE ${`${MANUAL_OPEN_TICKET_PREFIX}%`} OR ${openTrade.brokerMeta} ->> 'manualEntry' = 'true')`
          )
        )
        .orderBy(sql`${openTrade.openTime} DESC`);

      return rows.map((row) => {
        const brokerMeta =
          row.brokerMeta &&
          typeof row.brokerMeta === "object" &&
          !Array.isArray(row.brokerMeta)
            ? (row.brokerMeta as Record<string, unknown>)
            : {};

        return {
          id: row.id,
          ticket: row.ticket,
          symbol: row.symbol,
          tradeType: row.tradeType === "short" ? "short" : "long",
          volume: Number(row.volume || 0),
          openPrice: Number(row.openPrice || 0),
          currentPrice:
            row.currentPrice != null ? Number(row.currentPrice) : null,
          profit: Number(row.profit || 0),
          commission: Number(row.commission || 0),
          swap: Number(row.swap || 0),
          openTime: row.openTime?.toISOString() ?? null,
          sl: row.sl != null ? Number(row.sl) : null,
          tp: row.tp != null ? Number(row.tp) : null,
          sessionTag: row.sessionTag,
          comment: row.comment,
          modelTag:
            typeof brokerMeta.manualModelTag === "string"
              ? brokerMeta.manualModelTag
              : null,
          customTags: Array.isArray(brokerMeta.manualCustomTags)
            ? brokerMeta.manualCustomTags.filter(
                (tag): tag is string => typeof tag === "string"
              )
            : [],
        };
      });
    }),
};
