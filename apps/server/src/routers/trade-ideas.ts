import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";

import { db } from "../db";
import { user as userTable } from "../db/schema/auth";
import { tradeIdeaShare, type TradeIdeaPhase } from "../db/schema/trade-ideas";
import {
  buildTradeIdeaDraft,
  generateTradeIdeaDescription,
  generateTradeIdeaTitle,
  getTradeIdeaByToken,
  isTradeIdeaExpired,
} from "../lib/trade-ideas/og-data";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

const shareTokenGenerator = customAlphabet(
  "abcdefghjkmnpqrstuvwxyz23456789",
  12
);

const directionSchema = z.enum(["long", "short"]);
const tradeIdeaPhaseSchema = z.enum(["pre-trade", "during-trade", "post-trade"]);

function requireIdeaOwnership(userId: string, ideaId: string) {
  return db
    .select()
    .from(tradeIdeaShare)
    .where(and(eq(tradeIdeaShare.id, ideaId), eq(tradeIdeaShare.userId, userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalNumberString(value: string | null | undefined) {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) return null;

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return trimmed;
}

function ensurePublicIdea(idea: Awaited<ReturnType<typeof getTradeIdeaByToken>>) {
  if (!idea || !idea.isActive || isTradeIdeaExpired(idea.expiresAt)) {
    return null;
  }

  return idea;
}

export const tradeIdeasRouter = router({
  getJournalDraft: protectedProcedure
    .input(
      z.object({
        journalEntryId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const draft = await buildTradeIdeaDraft(ctx.session.user.id, input.journalEntryId);

      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journal entry not found" });
      }

      return draft;
    }),

  createFromJournal: protectedProcedure
    .input(
      z.object({
        journalEntryId: z.string().min(1),
        symbol: z.string().trim().min(1).max(20).optional(),
        direction: directionSchema.optional(),
        tradePhase: tradeIdeaPhaseSchema.optional(),
        entryPrice: z.string().optional(),
        stopLoss: z.string().optional(),
        takeProfit: z.string().optional(),
        exitPrice: z.string().optional(),
        riskReward: z.string().optional(),
        title: z.string().trim().max(120).optional(),
        description: z.string().trim().max(500).optional(),
        timeframe: z.string().trim().max(10).optional(),
        session: z.string().trim().max(30).optional(),
        chartImageUrl: z.string().url().optional(),
        showUsername: z.boolean().default(true),
        showPrices: z.boolean().default(true),
        showRR: z.boolean().default(true),
        expiresInHours: z.number().min(1).max(8760).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const draft = await buildTradeIdeaDraft(ctx.session.user.id, input.journalEntryId);

      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journal entry not found" });
      }

      const symbol = input.symbol?.trim().toUpperCase() || draft.symbol;
      const direction = input.direction || draft.direction;
      const tradePhase =
        (input.tradePhase || draft.tradePhase || "pre-trade") as TradeIdeaPhase;
      const entryPrice = normalizeOptionalNumberString(input.entryPrice) ?? draft.entryPrice;
      const stopLoss = normalizeOptionalNumberString(input.stopLoss) ?? draft.stopLoss;
      const takeProfit =
        normalizeOptionalNumberString(input.takeProfit) ?? draft.takeProfit;
      const exitPrice = normalizeOptionalNumberString(input.exitPrice) ?? draft.exitPrice;
      const riskReward =
        normalizeOptionalNumberString(input.riskReward) ?? draft.riskReward;

      if (!symbol) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not infer the symbol. Add a linked trade or include the symbol in the entry title.",
        });
      }

      if (!direction) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not infer the direction. Add long or short to the entry title or notes.",
        });
      }

      const chartImageUrl = input.chartImageUrl ?? draft.chartImageUrl;
      if (!chartImageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add a chart image to this journal entry before sharing it as a trade idea.",
        });
      }

      const expiresAt = input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
        : null;
      const ogImageVersion = new Date();

      const [createdIdea] = await db
        .insert(tradeIdeaShare)
        .values({
          userId: ctx.session.user.id,
          journalEntryId: input.journalEntryId,
          shareToken: shareTokenGenerator(),
          symbol,
          direction,
          entryPrice,
          stopLoss,
          takeProfit,
          exitPrice,
          riskReward,
          title: generateTradeIdeaTitle({
            title: input.title ?? draft.title,
            symbol,
            direction,
          }),
          description: generateTradeIdeaDescription(
            input.description ?? draft.description
          ),
          tradePhase,
          strategyName: draft.strategyName,
          timeframe: normalizeOptionalText(input.timeframe),
          session: normalizeOptionalText(input.session),
          chartImageUrl,
          chartImageWidth: draft.chartImageWidth,
          chartImageHeight: draft.chartImageHeight,
          ogImageGeneratedAt: ogImageVersion,
          showUsername: input.showUsername,
          showPrices: input.showPrices,
          showRR: input.showRR,
          authorDisplayName: draft.authorDisplayName,
          authorUsername: draft.authorUsername,
          authorAvatarUrl: draft.authorAvatarUrl,
          authorBannerUrl: draft.authorBannerUrl,
          authorProfileEffects: draft.authorProfileEffects as any,
          expiresAt,
        })
        .returning({
          id: tradeIdeaShare.id,
          shareToken: tradeIdeaShare.shareToken,
          createdAt: tradeIdeaShare.createdAt,
          ogImageGeneratedAt: tradeIdeaShare.ogImageGeneratedAt,
        });

      const imageVersion =
        createdIdea.ogImageGeneratedAt?.getTime() ?? createdIdea.createdAt.getTime();

      return {
        id: createdIdea.id,
        shareToken: createdIdea.shareToken,
        sharePath: `/idea/${createdIdea.shareToken}`,
        shareUrl: `/idea/${createdIdea.shareToken}`,
        ogImagePath: `/api/og/idea/${createdIdea.shareToken}?v=${imageVersion}`,
      };
    }),

  createDirect: protectedProcedure
    .input(
      z.object({
        symbol: z.string().trim().min(1).max(20),
        direction: directionSchema,
        entryPrice: z.string().optional(),
        stopLoss: z.string().optional(),
        takeProfit: z.string().optional(),
        exitPrice: z.string().optional(),
        riskReward: z.string().optional(),
        title: z.string().trim().max(120).optional(),
        description: z.string().trim().max(500).optional(),
        tradePhase: tradeIdeaPhaseSchema.default("pre-trade"),
        strategyName: z.string().trim().max(60).optional(),
        timeframe: z.string().trim().max(10).optional(),
        session: z.string().trim().max(30).optional(),
        chartImageUrl: z.string().url(),
        showUsername: z.boolean().default(true),
        showPrices: z.boolean().default(true),
        showRR: z.boolean().default(true),
        expiresInHours: z.number().min(1).max(8760).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [author] = await db
        .select({
          displayName: userTable.displayName,
          name: userTable.name,
          username: userTable.username,
          avatarUrl: userTable.image,
          bannerUrl: userTable.profileBannerUrl,
          profileEffects: userTable.profileEffects,
        })
        .from(userTable)
        .where(eq(userTable.id, ctx.session.user.id))
        .limit(1);

      const expiresAt = input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
        : null;
      const ogImageVersion = new Date();

      const [createdIdea] = await db
        .insert(tradeIdeaShare)
        .values({
          userId: ctx.session.user.id,
          shareToken: shareTokenGenerator(),
          symbol: input.symbol.trim().toUpperCase(),
          direction: input.direction,
          entryPrice: normalizeOptionalNumberString(input.entryPrice),
          stopLoss: normalizeOptionalNumberString(input.stopLoss),
          takeProfit: normalizeOptionalNumberString(input.takeProfit),
          exitPrice: normalizeOptionalNumberString(input.exitPrice),
          riskReward: normalizeOptionalNumberString(input.riskReward),
          title: generateTradeIdeaTitle({
            title: input.title,
            symbol: input.symbol,
            direction: input.direction,
          }),
          description: generateTradeIdeaDescription(input.description),
          tradePhase: input.tradePhase as TradeIdeaPhase,
          strategyName: normalizeOptionalText(input.strategyName),
          timeframe: normalizeOptionalText(input.timeframe),
          session: normalizeOptionalText(input.session),
          chartImageUrl: input.chartImageUrl,
          ogImageGeneratedAt: ogImageVersion,
          showUsername: input.showUsername,
          showPrices: input.showPrices,
          showRR: input.showRR,
          authorDisplayName:
            normalizeOptionalText(author?.displayName) ?? normalizeOptionalText(author?.name),
          authorUsername: normalizeOptionalText(author?.username),
          authorAvatarUrl: normalizeOptionalText(author?.avatarUrl),
          authorBannerUrl: normalizeOptionalText(author?.bannerUrl),
          authorProfileEffects: (author?.profileEffects ?? null) as any,
          expiresAt,
        })
        .returning({
          id: tradeIdeaShare.id,
          shareToken: tradeIdeaShare.shareToken,
          createdAt: tradeIdeaShare.createdAt,
          ogImageGeneratedAt: tradeIdeaShare.ogImageGeneratedAt,
        });

      const imageVersion =
        createdIdea.ogImageGeneratedAt?.getTime() ?? createdIdea.createdAt.getTime();

      return {
        id: createdIdea.id,
        shareToken: createdIdea.shareToken,
        sharePath: `/idea/${createdIdea.shareToken}`,
        shareUrl: `/idea/${createdIdea.shareToken}`,
        ogImagePath: `/api/og/idea/${createdIdea.shareToken}?v=${imageVersion}`,
      };
    }),

  getByToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const idea = ensurePublicIdea(await getTradeIdeaByToken(input.token));
      if (!idea) {
        return null;
      }

      return idea;
    }),

  recordView: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const idea = ensurePublicIdea(await getTradeIdeaByToken(input.token));
      if (!idea) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade idea not found" });
      }

      const [updated] = await db
        .update(tradeIdeaShare)
        .set({
          viewCount: sql`${tradeIdeaShare.viewCount} + 1`,
        })
        .where(eq(tradeIdeaShare.id, idea.id))
        .returning({ viewCount: tradeIdeaShare.viewCount });

      return {
        viewCount: updated?.viewCount ?? idea.viewCount + 1,
      };
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const ideas = await db
      .select()
      .from(tradeIdeaShare)
      .where(eq(tradeIdeaShare.userId, ctx.session.user.id))
      .orderBy(desc(tradeIdeaShare.createdAt));

    return ideas.map((idea) => ({
      ...idea,
      sharePath: `/idea/${idea.shareToken}`,
      status: !idea.isActive
        ? "deactivated"
        : isTradeIdeaExpired(idea.expiresAt)
          ? "expired"
          : "active",
    }));
  }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await requireIdeaOwnership(ctx.session.user.id, input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade idea not found" });
      }

      const [updated] = await db
        .update(tradeIdeaShare)
        .set({ isActive: false })
        .where(eq(tradeIdeaShare.id, input.id))
        .returning();

      return updated;
    }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        showUsername: z.boolean().optional(),
        showPrices: z.boolean().optional(),
        showRR: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await requireIdeaOwnership(ctx.session.user.id, input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade idea not found" });
      }

      const [updated] = await db
        .update(tradeIdeaShare)
        .set({
          showUsername: input.showUsername,
          showPrices: input.showPrices,
          showRR: input.showRR,
          ogImageUrl: null,
          ogImageGeneratedAt: new Date(),
        })
        .where(eq(tradeIdeaShare.id, input.id))
        .returning();

      return updated;
    }),
});
