import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../lib/trpc";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../db";
import { tradeNote } from "../../db/schema/journal";
import { trade } from "../../db/schema/trading";
import { notifyEarnedAchievements } from "../../lib/achievements";
import {
  getContractSizeForSymbol,
  getPipSizeForSymbol,
} from "../../lib/dukascopy";
import { archiveDeletedImportedTrades } from "../../lib/trade-import/deleted-imported-trades";
import {
  updateAccountManipulation,
  updateAccountPostExitPeaks,
} from "../../lib/manipulation-calculator";
import { syncPropAccountState } from "../../lib/prop-rule-monitor";
import { upsertPlainTextTradeNotes } from "../../lib/trades/trade-notes";
import {
  ensureAccountOwnership,
  ensureTradeBatchOwnership,
  ensureTradeOwnership,
  getMt5BrokerMeta,
  invalidateTradeScopeCaches,
  nullableHexColorSchema,
} from "./shared";

function deriveOutcome(profit: number, commissions = 0, swap = 0) {
  const netProfit = profit - commissions - Math.abs(swap);
  if (netProfit > 0) return "Win" as const;
  if (netProfit < -0.01) return "Loss" as const;
  return "BE" as const;
}

const deletedImportedTradeArchiveColumns = {
  id: trade.id,
  originalTradeId: trade.id,
  accountId: trade.accountId,
  ticket: trade.ticket,
  open: trade.open,
  tradeType: trade.tradeType,
  volume: trade.volume,
  symbol: trade.symbol,
  openPrice: trade.openPrice,
  sl: trade.sl,
  tp: trade.tp,
  close: trade.close,
  closePrice: trade.closePrice,
  swap: trade.swap,
  commissions: trade.commissions,
  profit: trade.profit,
  pips: trade.pips,
  tradeDurationSeconds: trade.tradeDurationSeconds,
  openTime: trade.openTime,
  closeTime: trade.closeTime,
  sessionTag: trade.sessionTag,
  sessionTagColor: trade.sessionTagColor,
  brokerMeta: trade.brokerMeta,
};

export const tradeMutationProcedures = {
  updateKillzone: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        killzone: z.string().nullable(),
        killzoneColor: nullableHexColorSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ownedTrade = await ensureTradeOwnership(
        ctx.session.user.id,
        input.tradeId
      );

      await db
        .update(trade)
        .set({
          killzone: input.killzone,
          killzoneColor: input.killzoneColor,
          sessionTag: input.killzone,
          sessionTagColor: input.killzoneColor,
        })
        .where(eq(trade.id, input.tradeId));

      await invalidateTradeScopeCaches([ownedTrade.accountId]);

      return { success: true };
    }),

  updateSessionTag: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        sessionTag: z.string().nullable(),
        sessionTagColor: nullableHexColorSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ownedTrade = await ensureTradeOwnership(
        ctx.session.user.id,
        input.tradeId
      );

      let canonicalTag = input.sessionTag;
      if (input.sessionTag) {
        const existingTagRows = await db
          .select({ sessionTag: trade.sessionTag })
          .from(trade)
          .where(
            and(
              eq(trade.accountId, ownedTrade.accountId),
              sql`lower(${trade.sessionTag}) = lower(${input.sessionTag})`
            )
          )
          .limit(1);

        if (existingTagRows[0]?.sessionTag) {
          canonicalTag = existingTagRows[0].sessionTag;
        }
      }

      await db
        .update(trade)
        .set({
          sessionTag: canonicalTag,
          sessionTagColor: input.sessionTagColor,
          killzone: canonicalTag,
          killzoneColor: input.sessionTagColor,
        })
        .where(eq(trade.id, input.tradeId));

      if (canonicalTag) {
        await db
          .update(trade)
          .set({
            sessionTag: canonicalTag,
            sessionTagColor: input.sessionTagColor,
            killzone: canonicalTag,
            killzoneColor: input.sessionTagColor,
          })
          .where(
            and(
              eq(trade.accountId, ownedTrade.accountId),
              sql`lower(${trade.sessionTag}) = lower(${canonicalTag})`
            )
          );
      }

      await invalidateTradeScopeCaches([ownedTrade.accountId]);

      return { success: true };
    }),

  backfillDerivedMetrics: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        postExitWindowSeconds: z
          .number()
          .min(60)
          .max(24 * 3600)
          .default(3600),
        onlyMissing: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureAccountOwnership(ctx.session.user.id, input.accountId);

      const manipulation = await updateAccountManipulation(input.accountId);
      const postExit = await updateAccountPostExitPeaks(
        input.accountId,
        input.postExitWindowSeconds,
        input.onlyMissing
      );

      return {
        success: true,
        manipulation,
        postExit,
      };
    }),

  updateModelTag: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        modelTag: z.string().nullable(),
        modelTagColor: nullableHexColorSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ownedTrade = await ensureTradeOwnership(
        ctx.session.user.id,
        input.tradeId
      );

      await db
        .update(trade)
        .set({
          modelTag: input.modelTag,
          modelTagColor: input.modelTagColor,
        })
        .where(eq(trade.id, input.tradeId));

      await invalidateTradeScopeCaches([ownedTrade.accountId]);

      return { success: true };
    }),

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
      const ownedTrade = await ensureTradeOwnership(
        ctx.session.user.id,
        input.tradeId
      );

      await db
        .update(trade)
        .set({ protocolAlignment: input.protocolAlignment })
        .where(eq(trade.id, input.tradeId));

      await invalidateTradeScopeCaches([ownedTrade.accountId]);

      return { success: true };
    }),

  bulkUpdateSessionTags: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        sessionTag: z.string().nullable(),
        sessionTagColor: nullableHexColorSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accountIds } = await ensureTradeBatchOwnership(
        ctx.session.user.id,
        input.tradeIds
      );

      let canonicalTag = input.sessionTag;
      if (input.sessionTag) {
        const existingTagRows = await db
          .select({ sessionTag: trade.sessionTag })
          .from(trade)
          .where(
            and(
              inArray(trade.accountId, accountIds),
              sql`lower(${trade.sessionTag}) = lower(${input.sessionTag})`
            )
          )
          .limit(1);

        if (existingTagRows[0]?.sessionTag) {
          canonicalTag = existingTagRows[0].sessionTag;
        }
      }

      await db
        .update(trade)
        .set({
          sessionTag: canonicalTag,
          sessionTagColor: input.sessionTagColor,
          killzone: canonicalTag,
          killzoneColor: input.sessionTagColor,
        })
        .where(inArray(trade.id, input.tradeIds));

      if (canonicalTag) {
        for (const accountId of accountIds) {
          await db
            .update(trade)
            .set({
              sessionTag: canonicalTag,
              sessionTagColor: input.sessionTagColor,
              killzone: canonicalTag,
              killzoneColor: input.sessionTagColor,
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

      return { success: true, updatedCount: input.tradeIds.length };
    }),

  bulkUpdateModelTags: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        modelTag: z.string().nullable(),
        modelTagColor: nullableHexColorSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accountIds } = await ensureTradeBatchOwnership(
        ctx.session.user.id,
        input.tradeIds
      );

      await db
        .update(trade)
        .set({
          modelTag: input.modelTag,
          modelTagColor: input.modelTagColor,
        })
        .where(inArray(trade.id, input.tradeIds));

      await invalidateTradeScopeCaches(accountIds);

      return { success: true, updatedCount: input.tradeIds.length };
    }),

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
      const { accountIds } = await ensureTradeBatchOwnership(
        ctx.session.user.id,
        input.tradeIds
      );

      await db
        .update(trade)
        .set({ protocolAlignment: input.protocolAlignment })
        .where(inArray(trade.id, input.tradeIds));

      await invalidateTradeScopeCaches(accountIds);

      return { success: true, updatedCount: input.tradeIds.length };
    }),

  bulkDeleteTrades: protectedProcedure
    .input(z.object({ tradeIds: z.array(z.string().min(1)).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const { accountIds } = await ensureTradeBatchOwnership(
        ctx.session.user.id,
        input.tradeIds
      );

      const archivedTrades = await db
        .select(deletedImportedTradeArchiveColumns)
        .from(trade)
        .where(inArray(trade.id, input.tradeIds));

      // neon-http does not support transactions, so archive first and only
      // delete after the tombstones have been written.
      await archiveDeletedImportedTrades({
        tx: db,
        trades: archivedTrades,
      });
      await db.delete(trade).where(inArray(trade.id, input.tradeIds));

      await invalidateTradeScopeCaches(accountIds);
      await Promise.all(
        accountIds.map((accountId) =>
          syncPropAccountState(accountId, { saveAlerts: true })
        )
      );

      return { success: true, deletedCount: input.tradeIds.length };
    }),

  bulkAddNotes: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        note: z.string().min(1),
        appendToExisting: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accountIds } = await ensureTradeBatchOwnership(
        ctx.session.user.id,
        input.tradeIds
      );

      const existingNotes = await db
        .select({
          id: tradeNote.id,
          tradeId: tradeNote.tradeId,
          content: tradeNote.content,
          plainTextContent: tradeNote.plainTextContent,
        })
        .from(tradeNote)
        .where(
          and(
            eq(tradeNote.userId, ctx.session.user.id),
            inArray(tradeNote.tradeId, input.tradeIds)
          )
        );

      const result = await upsertPlainTextTradeNotes({
        userId: ctx.session.user.id,
        tradeIds: input.tradeIds,
        note: input.note,
        appendToExisting: input.appendToExisting,
        existingNotes,
      });

      await invalidateTradeScopeCaches(accountIds);

      return result;
    }),

  bulkToggleFavorite: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        favorite: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accountIds } = await ensureTradeBatchOwnership(
        ctx.session.user.id,
        input.tradeIds
      );

      const trades = await db
        .select({
          id: trade.id,
          brokerMeta: trade.brokerMeta,
        })
        .from(trade)
        .where(inArray(trade.id, input.tradeIds));

      for (const currentTrade of trades) {
        const brokerMeta = getMt5BrokerMeta(currentTrade.brokerMeta) ?? {};
        const currentText =
          typeof brokerMeta.closeText === "string" ? brokerMeta.closeText : "";
        const newText = input.favorite
          ? currentText.includes("[FAVORITE]")
            ? currentText
            : `${currentText} [FAVORITE]`
          : currentText.replace(/\s*\[FAVORITE\]\s*/g, "").trim();

        await db
          .update(trade)
          .set({
            brokerMeta: {
              ...brokerMeta,
              closeText: newText || null,
            },
          })
          .where(eq(trade.id, currentTrade.id));
      }

      await invalidateTradeScopeCaches(accountIds);

      return { success: true, updatedCount: input.tradeIds.length };
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        symbol: z.string().min(1).max(20),
        tradeType: z.enum(["long", "short"]),
        volume: z.number().positive(),
        openPrice: z.number().positive(),
        closePrice: z.number().positive(),
        openTime: z.string(),
        closeTime: z.string(),
        sl: z.number().optional(),
        tp: z.number().optional(),
        profit: z.number().optional(),
        commissions: z.number().optional(),
        swap: z.number().optional(),
        sessionTag: z.string().optional(),
        modelTag: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAccountOwnership(ctx.session.user.id, input.accountId);

      const openTime = new Date(input.openTime);
      const closeTime = new Date(input.closeTime);

      if (
        Number.isNaN(openTime.getTime()) ||
        Number.isNaN(closeTime.getTime())
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid date format",
        });
      }
      if (closeTime <= openTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Close time must be after open time",
        });
      }

      const durationSeconds = Math.floor(
        (closeTime.getTime() - openTime.getTime()) / 1000
      );
      const pipSize = getPipSizeForSymbol(input.symbol);
      const priceDiff =
        input.tradeType === "long"
          ? input.closePrice - input.openPrice
          : input.openPrice - input.closePrice;
      const pips = priceDiff / pipSize;
      const contractSize = getContractSizeForSymbol(input.symbol);
      const profit = input.profit ?? priceDiff * input.volume * contractSize;
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
          outcome: deriveOutcome(
            profit,
            input.commissions || 0,
            input.swap || 0
          ),
          sessionTag: input.sessionTag || null,
          modelTag: input.modelTag || null,
        })
        .returning();

      if (input.sl && input.tp) {
        const plannedRiskPips = Math.abs(input.openPrice - input.sl) / pipSize;
        const plannedTargetPips =
          Math.abs(input.tp - input.openPrice) / pipSize;
        const plannedRR =
          plannedRiskPips > 0 ? plannedTargetPips / plannedRiskPips : null;

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

      await invalidateTradeScopeCaches([input.accountId]);
      await syncPropAccountState(input.accountId, { saveAlerts: true });
      void notifyEarnedAchievements({
        userId: ctx.session.user.id,
        accountId: input.accountId,
        source: "manual-trade",
      }).catch((error) => {
        console.error("[Trades] Achievement notification failed:", error);
      });

      return {
        id: newTrade.id,
        symbol: newTrade.symbol,
        profit: Number(newTrade.profit || 0),
        pips: Number(newTrade.pips || 0),
        outcome: newTrade.outcome,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedTrade = await ensureTradeOwnership(
        ctx.session.user.id,
        input.tradeId
      );

      const updates: Record<string, any> = {};

      if (input.symbol !== undefined)
        updates.symbol = input.symbol.toUpperCase();
      if (input.tradeType !== undefined) updates.tradeType = input.tradeType;
      if (input.volume !== undefined) updates.volume = input.volume.toString();
      if (input.openPrice !== undefined)
        updates.openPrice = input.openPrice.toString();
      if (input.closePrice !== undefined)
        updates.closePrice = input.closePrice.toString();
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
      if (input.commissions !== undefined) {
        updates.commissions = input.commissions.toString();
      }
      if (input.swap !== undefined) updates.swap = input.swap.toString();
      if (input.sessionTag !== undefined) updates.sessionTag = input.sessionTag;
      if (input.modelTag !== undefined) updates.modelTag = input.modelTag;

      if (
        input.profit !== undefined ||
        input.commissions !== undefined ||
        input.swap !== undefined
      ) {
        updates.outcome = deriveOutcome(
          input.profit ?? 0,
          input.commissions ?? 0,
          input.swap ?? 0
        );
      }

      const [updated] = await db
        .update(trade)
        .set(updates)
        .where(eq(trade.id, input.tradeId))
        .returning();

      await invalidateTradeScopeCaches([ownedTrade.accountId]);
      await syncPropAccountState(ownedTrade.accountId, { saveAlerts: true });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ownedTrade = await ensureTradeOwnership(
        ctx.session.user.id,
        input.tradeId
      );

      const [archivedTrade] = await db
        .select(deletedImportedTradeArchiveColumns)
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (archivedTrade) {
        await archiveDeletedImportedTrades({
          tx: db,
          trades: [archivedTrade],
        });
      }
      await db.delete(trade).where(eq(trade.id, input.tradeId));

      await invalidateTradeScopeCaches([ownedTrade.accountId]);
      await syncPropAccountState(ownedTrade.accountId, { saveAlerts: true });

      return { ok: true };
    }),
};
