import { router, protectedProcedure, publicProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { pnlCardTemplate, sharedPnlCard, trade, tradingAccount } from "../db/schema/trading";
import { eq, and, desc, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

// Helper to generate short share IDs
function generateShareId(): string {
  return nanoid(10); // Generates a 10-character URL-safe ID
}

// Card layout schema
const cardLayoutSchema = z.object({
  font: z.string().default("Inter"),
  fontSize: z.object({
    title: z.number().default(32),
    stat: z.number().default(24),
    label: z.number().default(14),
  }),
  colors: z.object({
    primary: z.string().default("#ffffff"),
    secondary: z.string().default("#9CA3AF"),
    accent: z.string().default("#10B981"),
    negative: z.string().default("#EF4444"),
  }),
  elements: z.array(z.string()).default(["profit", "rr", "winRate", "duration", "symbol"]),
  logoPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).default("top-right"),
});

export const pnlCardsRouter = router({
  // ============== TEMPLATES ==============

  // List all available templates (system + user's own + public)
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    const templates = await db
      .select()
      .from(pnlCardTemplate)
      .where(
        and(
          // System templates OR user's own templates OR public templates
          isNull(pnlCardTemplate.userId) // System templates have null userId
        )
      )
      .orderBy(desc(pnlCardTemplate.usageCount), desc(pnlCardTemplate.createdAt));

    // Also get user's templates
    const userTemplates = await db
      .select()
      .from(pnlCardTemplate)
      .where(eq(pnlCardTemplate.userId, ctx.session.user.id))
      .orderBy(desc(pnlCardTemplate.createdAt));

    // Also get public templates
    const publicTemplates = await db
      .select()
      .from(pnlCardTemplate)
      .where(eq(pnlCardTemplate.isPublic, true))
      .orderBy(desc(pnlCardTemplate.usageCount));

    // Combine and deduplicate
    const allTemplates = [...templates, ...userTemplates, ...publicTemplates];
    const uniqueTemplates = Array.from(
      new Map(allTemplates.map((t) => [t.id, t])).values()
    );

    return uniqueTemplates;
  }),

  // Create a new template
  createTemplate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        backgroundType: z.enum(["gradient", "image", "solid"]),
        backgroundValue: z.string(),
        backgroundImageUrl: z.string().optional(),
        layout: cardLayoutSchema,
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const template = await db
        .insert(pnlCardTemplate)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          backgroundType: input.backgroundType,
          backgroundValue: input.backgroundValue,
          backgroundImageUrl: input.backgroundImageUrl,
          layout: input.layout as any,
          isPublic: input.isPublic,
          isSystem: false,
        })
        .returning();

      return template[0];
    }),

  // Update a template
  updateTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        backgroundType: z.enum(["gradient", "image", "solid"]).optional(),
        backgroundValue: z.string().optional(),
        backgroundImageUrl: z.string().optional(),
        layout: cardLayoutSchema.optional(),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { templateId, ...updates } = input;

      // Verify ownership
      const existing = await db
        .select()
        .from(pnlCardTemplate)
        .where(eq(pnlCardTemplate.id, templateId))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      if (existing[0].userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your template" });
      }

      const updated = await db
        .update(pnlCardTemplate)
        .set({
          ...updates,
          layout: updates.layout as any,
          updatedAt: new Date(),
        })
        .where(eq(pnlCardTemplate.id, templateId))
        .returning();

      return updated[0];
    }),

  // Delete a template
  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const existing = await db
        .select()
        .from(pnlCardTemplate)
        .where(eq(pnlCardTemplate.id, input.templateId))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      if (existing[0].userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your template" });
      }

      await db.delete(pnlCardTemplate).where(eq(pnlCardTemplate.id, input.templateId));

      return { success: true };
    }),

  // ============== SHARED CARDS ==============

  // Create a shared card
  createSharedCard: protectedProcedure
    .input(
      z.object({
        tradeId: z.string(),
        templateId: z.string().optional(),
        config: z.object({
          backgroundType: z.enum(["gradient", "image", "solid"]),
          backgroundValue: z.string(),
          backgroundImageUrl: z.string().optional(),
          layout: cardLayoutSchema,
          customText: z.string().optional(),
          showBranding: z.boolean().default(true),
        }),
        isPublic: z.boolean().default(true),
        expiresAt: z.date().optional(),
        password: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify trade ownership
      const tradeData = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          symbol: trade.symbol,
          tradeType: trade.tradeType,
          profit: trade.profit,
          openPrice: trade.openPrice,
          closePrice: trade.closePrice,
          volume: trade.volume,
          open: trade.open,
          close: trade.close,
          realisedRR: trade.realisedRR,
          outcome: trade.outcome,
          tradeDurationSeconds: trade.tradeDurationSeconds,
        })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!tradeData[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      // Verify account ownership
      const account = await db
        .select()
        .from(tradingAccount)
        .where(eq(tradingAccount.id, tradeData[0].accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your trade" });
      }

      // Generate share ID
      const shareId = generateShareId();

      // Prepare card data snapshot
      const cardData = {
        symbol: tradeData[0].symbol,
        tradeType: tradeData[0].tradeType,
        profit: Number(tradeData[0].profit || 0),
        openPrice: Number(tradeData[0].openPrice || 0),
        closePrice: Number(tradeData[0].closePrice || 0),
        volume: Number(tradeData[0].volume || 0),
        openTime: tradeData[0].open,
        closeTime: tradeData[0].close,
        realisedRR: Number(tradeData[0].realisedRR || 0),
        outcome: tradeData[0].outcome,
        duration: tradeData[0].tradeDurationSeconds,
      };

      // Increment template usage count if template is used
      if (input.templateId) {
        await db
          .update(pnlCardTemplate)
          .set({
            usageCount: (pnlCardTemplate.usageCount as any) + 1,
          })
          .where(eq(pnlCardTemplate.id, input.templateId));
      }

      // Create shared card
      const sharedCard = await db
        .insert(sharedPnlCard)
        .values({
          shareId,
          userId: ctx.session.user.id,
          tradeId: input.tradeId,
          templateId: input.templateId,
          config: input.config as any,
          cardData: cardData as any,
          isPublic: input.isPublic,
          expiresAt: input.expiresAt,
          password: input.password ? await Bun.password.hash(input.password) : null,
        })
        .returning();

      return {
        ...sharedCard[0],
        shareUrl: `/share/${shareId}`,
      };
    }),

  // Get a shared card by share ID (public endpoint)
  getSharedCard: publicProcedure
    .input(
      z.object({
        shareId: z.string(),
        password: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const card = await db
        .select()
        .from(sharedPnlCard)
        .where(eq(sharedPnlCard.shareId, input.shareId))
        .limit(1);

      if (!card[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }

      // Check expiration
      if (card[0].expiresAt && new Date() > card[0].expiresAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Card has expired" });
      }

      // Check password
      if (card[0].password) {
        if (!input.password || !(await Bun.password.verify(input.password, card[0].password))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Invalid password" });
        }
      }

      // Increment view count
      await db
        .update(sharedPnlCard)
        .set({
          viewCount: (sharedPnlCard.viewCount as any) + 1,
          lastViewedAt: new Date(),
        })
        .where(eq(sharedPnlCard.id, card[0].id));

      return card[0];
    }),

  // List user's shared cards
  listUserSharedCards: protectedProcedure.query(async ({ ctx }) => {
    const cards = await db
      .select()
      .from(sharedPnlCard)
      .where(eq(sharedPnlCard.userId, ctx.session.user.id))
      .orderBy(desc(sharedPnlCard.createdAt));

    return cards.map((card) => ({
      ...card,
      shareUrl: `/share/${card.shareId}`,
    }));
  }),

  // Delete a shared card
  deleteSharedCard: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const existing = await db
        .select()
        .from(sharedPnlCard)
        .where(eq(sharedPnlCard.id, input.cardId))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }

      if (existing[0].userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }

      await db.delete(sharedPnlCard).where(eq(sharedPnlCard.id, input.cardId));

      return { success: true };
    }),

  // Get card analytics
  getCardAnalytics: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ input, ctx }) => {
      const card = await db
        .select()
        .from(sharedPnlCard)
        .where(eq(sharedPnlCard.id, input.cardId))
        .limit(1);

      if (!card[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }

      if (card[0].userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }

      return {
        viewCount: card[0].viewCount,
        lastViewedAt: card[0].lastViewedAt,
        createdAt: card[0].createdAt,
        isExpired: card[0].expiresAt ? new Date() > card[0].expiresAt : false,
      };
    }),
});
