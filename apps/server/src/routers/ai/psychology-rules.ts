import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import {
  ruleViolation,
  tradeChecklistResult,
  tradeChecklistTemplate,
  tradeEmotion,
  tradingRule,
} from "../../db/schema/coaching";
import { tradingAccount } from "../../db/schema/trading";
import {
  computeMentalPerformanceScore,
  computePsychologyProfile,
  detectTiltStatus,
  generateSuggestedRules,
  getDailyComplianceReport,
  getFullProfile,
} from "../../lib/ai/engine";
import { protectedProcedure } from "../../lib/trpc";
import { TRPCError } from "@trpc/server";

async function assertOwnedAccount(accountId: string, userId: string) {
  const account = await db.query.tradingAccount.findFirst({
    where: and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)),
    columns: { id: true },
  });

  if (!account) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
  }
}

export const aiPsychologyRuleProcedures = {
  tagEmotion: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().optional(),
        accountId: z.string(),
        stage: z.enum(["pre_entry", "during", "post_exit"]),
        emotion: z.string(),
        intensity: z.number().min(1).max(5).default(3),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const baseConditions = [
        eq(tradeEmotion.accountId, input.accountId),
        eq(tradeEmotion.userId, ctx.session.user.id),
        eq(tradeEmotion.stage, input.stage),
      ];

      const existingEmotion = input.tradeId
        ? await db.query.tradeEmotion.findFirst({
            where: and(
              ...baseConditions,
              eq(tradeEmotion.tradeId, input.tradeId)
            ),
            orderBy: desc(tradeEmotion.createdAt),
          })
        : await db.query.tradeEmotion.findFirst({
            where: and(...baseConditions, isNull(tradeEmotion.tradeId)),
            orderBy: desc(tradeEmotion.createdAt),
          });

      if (existingEmotion) {
        const [emotion] = await db
          .update(tradeEmotion)
          .set({
            emotion: input.emotion,
            intensity: input.intensity,
            note: input.note,
          })
          .where(eq(tradeEmotion.id, existingEmotion.id))
          .returning();

        return emotion;
      }

      const [emotion] = await db
        .insert(tradeEmotion)
        .values({
          tradeId: input.tradeId || null,
          accountId: input.accountId,
          userId: ctx.session.user.id,
          stage: input.stage,
          emotion: input.emotion,
          intensity: input.intensity,
          note: input.note,
        })
        .returning();

      return emotion;
    }),

  getEmotions: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        tradeId: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const conditions = [
        eq(tradeEmotion.accountId, input.accountId),
        eq(tradeEmotion.userId, ctx.session.user.id),
      ];

      if (input.tradeId) {
        conditions.push(eq(tradeEmotion.tradeId, input.tradeId));
      }

      return db
        .select()
        .from(tradeEmotion)
        .where(and(...conditions))
        .orderBy(desc(tradeEmotion.createdAt))
        .limit(input.limit);
    }),

  getPsychologyProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return null;
      }

      return computePsychologyProfile(
        input.accountId,
        ctx.session.user.id,
        fullProfile.profile
      );
    }),

  getTiltStatus: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return {
          score: 100,
          tiltScore: 0,
          level: "green" as const,
          indicators: [],
          recentEmotions: [],
        };
      }

      return detectTiltStatus(
        input.accountId,
        ctx.session.user.id,
        fullProfile.profile
      );
    }),

  getMentalScore: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return null;
      }

      return computeMentalPerformanceScore(
        input.accountId,
        ctx.session.user.id,
        fullProfile.profile
      );
    }),

  getRules: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      return db
        .select()
        .from(tradingRule)
        .where(
          and(
            eq(tradingRule.accountId, input.accountId),
            eq(tradingRule.userId, ctx.session.user.id)
          )
        )
        .orderBy(desc(tradingRule.createdAt));
    }),

  createRule: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        category: z.string(),
        ruleType: z.string(),
        label: z.string(),
        description: z.string().optional(),
        parameters: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const [rule] = await db
        .insert(tradingRule)
        .values({
          accountId: input.accountId,
          userId: ctx.session.user.id,
          category: input.category,
          ruleType: input.ruleType,
          label: input.label,
          description: input.description,
          parameters: input.parameters,
        })
        .returning();

      return rule;
    }),

  updateRule: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        description: z.string().optional(),
        parameters: z.record(z.string(), z.any()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (input.label !== undefined) updates.label = input.label;
      if (input.description !== undefined)
        updates.description = input.description;
      if (input.parameters !== undefined) updates.parameters = input.parameters;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      const [rule] = await db
        .update(tradingRule)
        .set(updates)
        .where(
          and(
            eq(tradingRule.id, input.id),
            eq(tradingRule.userId, ctx.session.user.id)
          )
        )
        .returning();

      return rule;
    }),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(tradingRule)
        .where(
          and(
            eq(tradingRule.id, input.id),
            eq(tradingRule.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  getSuggestedRules: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return [];
      }

      return generateSuggestedRules(
        fullProfile.profile,
        fullProfile.edges,
        fullProfile.leaks
      );
    }),

  getDailyCompliance: protectedProcedure
    .input(z.object({ accountId: z.string(), date: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      return getDailyComplianceReport(
        input.accountId,
        ctx.session.user.id,
        input.date ? new Date(input.date) : undefined
      );
    }),

  getRuleViolations: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      return db
        .select()
        .from(ruleViolation)
        .where(
          and(
            eq(ruleViolation.accountId, input.accountId),
            eq(ruleViolation.userId, ctx.session.user.id)
          )
        )
        .orderBy(desc(ruleViolation.createdAt))
        .limit(input.limit);
    }),

  getChecklistTemplates: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      return db
        .select()
        .from(tradeChecklistTemplate)
        .where(
          and(
            eq(tradeChecklistTemplate.accountId, input.accountId),
            eq(tradeChecklistTemplate.userId, ctx.session.user.id)
          )
        )
        .orderBy(desc(tradeChecklistTemplate.createdAt));
    }),

  createChecklistTemplate: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        strategyTag: z.string().optional(),
        items: z.array(
          z.object({
            label: z.string(),
            isRequired: z.boolean().default(false),
            category: z.string().optional(),
          })
        ),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const [template] = await db
        .insert(tradeChecklistTemplate)
        .values({
          accountId: input.accountId,
          userId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          strategyTag: input.strategyTag,
          items: input.items,
          isDefault: input.isDefault,
        })
        .returning();

      return template;
    }),

  deleteChecklistTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(tradeChecklistTemplate)
        .where(
          and(
            eq(tradeChecklistTemplate.id, input.id),
            eq(tradeChecklistTemplate.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  saveChecklistResult: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().optional(),
        templateId: z.string(),
        accountId: z.string(),
        completedItems: z.array(
          z.object({
            itemIndex: z.number(),
            checked: z.boolean(),
            timestamp: z.string().optional(),
          })
        ),
        completionRate: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAccount(input.accountId, ctx.session.user.id);

      const [result] = await db
        .insert(tradeChecklistResult)
        .values({
          tradeId: input.tradeId || null,
          templateId: input.templateId,
          accountId: input.accountId,
          userId: ctx.session.user.id,
          completedItems: input.completedItems,
          completionRate: String(input.completionRate),
        })
        .returning();

      return result;
    }),
};
