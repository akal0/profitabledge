import { router, protectedProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { watchlistItem, tradeNote, tradeMedia } from "../db/schema/journal";
import { trade, tradingAccount } from "../db/schema/trading";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const watchlistRouter = router({
  list: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
      status: z.enum(["watching", "entered", "exited", "archived"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const conditions = [eq(watchlistItem.userId, userId)];
      
      if (input?.accountId) {
        conditions.push(eq(watchlistItem.accountId, input.accountId));
      }
      
      if (input?.status) {
        conditions.push(eq(watchlistItem.status, input.status));
      }
      
      const items = await db
        .select()
        .from(watchlistItem)
        .where(and(...conditions))
        .orderBy(desc(watchlistItem.priority), desc(watchlistItem.createdAt));
      
      return items;
    }),
  
  create: protectedProcedure
    .input(z.object({
      symbol: z.string().min(1).max(64),
      accountId: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      priority: z.number().min(-1).max(1).optional(),
      targetPrice: z.string().optional(),
      stopPrice: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const [item] = await db
        .insert(watchlistItem)
        .values({
          userId,
          symbol: input.symbol.toUpperCase(),
          accountId: input.accountId,
          notes: input.notes,
          tags: input.tags || [],
          priority: input.priority ?? 0,
          targetPrice: input.targetPrice,
          stopPrice: input.stopPrice,
        })
        .returning();
      
      return item;
    }),
  
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      symbol: z.string().min(1).max(64).optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      priority: z.number().min(-1).max(1).optional(),
      status: z.enum(["watching", "entered", "exited", "archived"]).optional(),
      targetPrice: z.string().optional(),
      stopPrice: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { id, ...updates } = input;
      
      const existing = await db
        .select()
        .from(watchlistItem)
        .where(and(eq(watchlistItem.id, id), eq(watchlistItem.userId, userId)))
        .limit(1);
      
      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist item not found" });
      }
      
      const [updated] = await db
        .update(watchlistItem)
        .set({
          ...updates,
          symbol: updates.symbol?.toUpperCase(),
          updatedAt: new Date(),
        })
        .where(eq(watchlistItem.id, id))
        .returning();
      
      return updated;
    }),
  
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const existing = await db
        .select()
        .from(watchlistItem)
        .where(and(eq(watchlistItem.id, input.id), eq(watchlistItem.userId, userId)))
        .limit(1);
      
      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist item not found" });
      }
      
      await db.delete(watchlistItem).where(eq(watchlistItem.id, input.id));
      
      return { success: true };
    }),
  
  reorder: protectedProcedure
    .input(z.object({
      items: z.array(z.object({ id: z.string(), sortOrder: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      for (const item of input.items) {
        await db
          .update(watchlistItem)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(and(eq(watchlistItem.id, item.id), eq(watchlistItem.userId, userId)));
      }
      
      return { success: true };
    }),
});

export const tradeNotesRouter = router({
  getByTradeId: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const note = await db
        .select()
        .from(tradeNote)
        .where(and(eq(tradeNote.tradeId, input.tradeId), eq(tradeNote.userId, userId)))
        .limit(1);
      
      return note[0] || null;
    }),
  
  upsert: protectedProcedure
    .input(z.object({
      tradeId: z.string(),
      content: z.any().optional(),
      htmlContent: z.string().optional(),
      plainTextContent: z.string().optional(),
      wordCount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const tradeExists = await db
        .select({ id: trade.id })
        .from(trade)
        .innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
        .where(and(eq(trade.id, input.tradeId), eq(tradingAccount.userId, userId)))
        .limit(1);
      
      if (!tradeExists[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }
      
      const existing = await db
        .select()
        .from(tradeNote)
        .where(and(eq(tradeNote.tradeId, input.tradeId), eq(tradeNote.userId, userId)))
        .limit(1);
      
      if (existing[0]) {
        const [updated] = await db
          .update(tradeNote)
          .set({
            content: input.content,
            htmlContent: input.htmlContent,
            plainTextContent: input.plainTextContent,
            wordCount: input.wordCount,
            updatedAt: new Date(),
          })
          .where(eq(tradeNote.id, existing[0].id))
          .returning();
        return updated;
      }
      
      const [created] = await db
        .insert(tradeNote)
        .values({
          tradeId: input.tradeId,
          userId,
          content: input.content,
          htmlContent: input.htmlContent,
          plainTextContent: input.plainTextContent,
          wordCount: input.wordCount,
        })
        .returning();
      
      return created;
    }),
  
  delete: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      await db
        .delete(tradeNote)
        .where(and(eq(tradeNote.tradeId, input.tradeId), eq(tradeNote.userId, userId)));
      
      return { success: true };
    }),
});
