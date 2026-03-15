import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../db';
import {
  journalEntry,
  journalImage,
  journalMedia,
  journalTemplate,
  tradeMedia,
  type JournalBlock,
} from '../../db/schema/journal';
import { protectedProcedure } from '../../lib/trpc';
import { journalBlockSchema } from './shared';

export const journalTemplateMediaProcedures = {
  listTemplates: protectedProcedure
    .input(z.object({
      category: z.enum(['daily', 'weekly', 'trade_review', 'strategy', 'custom']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        or(
          eq(journalTemplate.userId, ctx.session.user.id),
          eq(journalTemplate.isSystem, true),
          eq(journalTemplate.isPublic, true)
        ),
      ];

      if (input?.category) {
        conditions.push(eq(journalTemplate.category, input.category));
      }

      return db
        .select()
        .from(journalTemplate)
        .where(and(...conditions))
        .orderBy(desc(journalTemplate.isSystem), desc(journalTemplate.usageCount));
    }),

  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      emoji: z.string().max(10).optional(),
      content: z.array(journalBlockSchema).optional(),
      fromEntryId: z.string().optional(),
      category: z.enum(['daily', 'weekly', 'trade_review', 'strategy', 'custom']).optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let content = input.content ?? [];

      if (input.fromEntryId) {
        const [entry] = await db
          .select()
          .from(journalEntry)
          .where(and(
            eq(journalEntry.id, input.fromEntryId),
            eq(journalEntry.userId, ctx.session.user.id)
          ))
          .limit(1);

        if (entry?.content) {
          content = entry.content as JournalBlock[];
        }
      }

      const [template] = await db
        .insert(journalTemplate)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          emoji: input.emoji,
          content: content as any,
          category: input.category ?? 'custom',
          isPublic: input.isPublic ?? false,
        })
        .returning();

      return template;
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(journalTemplate)
        .where(and(
          eq(journalTemplate.id, input.id),
          eq(journalTemplate.userId, ctx.session.user.id),
          eq(journalTemplate.isSystem, false)
        ))
        .returning();

      if (!deleted) {
        throw new Error('Template not found or cannot be deleted');
      }

      return { success: true };
    }),

  createImage: protectedProcedure
    .input(z.object({
      url: z.string(),
      thumbnailUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      altText: z.string().optional(),
      caption: z.string().optional(),
      entryId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [image] = await db
        .insert(journalImage)
        .values({
          userId: ctx.session.user.id,
          ...input,
        })
        .returning();

      return image;
    }),

  linkImages: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      imageIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(journalImage)
        .set({ entryId: input.entryId })
        .where(and(
          inArray(journalImage.id, input.imageIds),
          eq(journalImage.userId, ctx.session.user.id)
        ));

      return { success: true };
    }),

  deleteImage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(journalImage)
        .where(and(
          eq(journalImage.id, input.id),
          eq(journalImage.userId, ctx.session.user.id)
        ))
        .returning();

      if (!deleted) {
        throw new Error('Image not found');
      }

      return { success: true };
    }),

  createMedia: protectedProcedure
    .input(z.object({
      entryId: z.string().optional(),
      mediaType: z.enum(['image', 'video', 'screen_recording']),
      url: z.string(),
      thumbnailUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      durationSeconds: z.number().optional(),
      altText: z.string().optional(),
      caption: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [media] = await db
        .insert(journalMedia)
        .values({
          userId: ctx.session.user.id,
          ...input,
        })
        .returning();

      return media;
    }),

  listMedia: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      mediaType: z.enum(['image', 'video', 'screen_recording']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(journalMedia.entryId, input.entryId),
        eq(journalMedia.userId, ctx.session.user.id),
      ];

      if (input.mediaType) {
        conditions.push(eq(journalMedia.mediaType, input.mediaType));
      }

      return db
        .select()
        .from(journalMedia)
        .where(and(...conditions))
        .orderBy(asc(journalMedia.sortOrder), desc(journalMedia.createdAt));
    }),

  updateMedia: protectedProcedure
    .input(z.object({
      id: z.string(),
      altText: z.string().optional(),
      caption: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await db
        .update(journalMedia)
        .set(updates)
        .where(and(
          eq(journalMedia.id, id),
          eq(journalMedia.userId, ctx.session.user.id)
        ))
        .returning();

      if (!updated) {
        throw new Error('Media not found');
      }

      return updated;
    }),

  deleteMedia: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(journalMedia)
        .where(and(
          eq(journalMedia.id, input.id),
          eq(journalMedia.userId, ctx.session.user.id)
        ))
        .returning();

      if (!deleted) {
        throw new Error('Media not found');
      }

      return { success: true };
    }),

  createTradeMedia: protectedProcedure
    .input(z.object({
      tradeId: z.string(),
      mediaType: z.enum(['image', 'video', 'screen_recording']),
      url: z.string(),
      thumbnailUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      durationSeconds: z.number().optional(),
      altText: z.string().optional(),
      caption: z.string().optional(),
      description: z.string().optional(),
      isEntryScreenshot: z.boolean().optional(),
      isExitScreenshot: z.boolean().optional(),
      isAnalysis: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [media] = await db
        .insert(tradeMedia)
        .values({
          userId: ctx.session.user.id,
          ...input,
        })
        .returning();

      return media;
    }),

  listTradeMedia: protectedProcedure
    .input(z.object({
      tradeId: z.string(),
      mediaType: z.enum(['image', 'video', 'screen_recording']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(tradeMedia.tradeId, input.tradeId),
        eq(tradeMedia.userId, ctx.session.user.id),
      ];

      if (input.mediaType) {
        conditions.push(eq(tradeMedia.mediaType, input.mediaType));
      }

      return db
        .select()
        .from(tradeMedia)
        .where(and(...conditions))
        .orderBy(asc(tradeMedia.sortOrder), desc(tradeMedia.createdAt));
    }),

  updateTradeMedia: protectedProcedure
    .input(z.object({
      id: z.string(),
      altText: z.string().optional(),
      caption: z.string().optional(),
      description: z.string().optional(),
      isEntryScreenshot: z.boolean().optional(),
      isExitScreenshot: z.boolean().optional(),
      isAnalysis: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await db
        .update(tradeMedia)
        .set(updates)
        .where(and(
          eq(tradeMedia.id, id),
          eq(tradeMedia.userId, ctx.session.user.id)
        ))
        .returning();

      if (!updated) {
        throw new Error('Media not found');
      }

      return updated;
    }),

  deleteTradeMedia: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(tradeMedia)
        .where(and(
          eq(tradeMedia.id, input.id),
          eq(tradeMedia.userId, ctx.session.user.id)
        ))
        .returning();

      if (!deleted) {
        throw new Error('Media not found');
      }

      return { success: true };
    }),
};
