/**
 * Journal Router
 * 
 * Handles CRUD operations for journal entries, templates, images, and media.
 * Supports Notion-style block-based content with embedded charts and trades.
 * 
 * Features:
 * - Trade Ideas Journal: Pre-trade, during-trade, post-trade phases
 * - Psychology Tracker: Mood, confidence, emotional state tracking
 * - Media Attachments: Images and videos for trades and entries
 */

import { router, protectedProcedure } from '../lib/trpc';
import { db } from '../db';
import { 
  journalEntry, 
  journalTemplate, 
  journalImage, 
  journalMedia,
  tradeMedia,
  journalEntryGoal,
  journalPromptQueue,
  psychologyCorrelation,
  type PsychologySnapshot 
} from '../db/schema/journal';
import type { JournalBlock } from '../db/schema/journal';
import { goal } from '../db/schema/trading';
import { eq, and, desc, asc, or, ilike, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { generateJournalSummary, generateJournalContextQuery, extractPatternsFromEntries } from '../lib/journal-ai-analysis';
import { calculatePsychologyCorrelations, getCachedCorrelations, getBestTradingConditions } from '../lib/psychology-correlation';
import { isAllAccountsScope, resolveScopedAccountIds } from "../lib/account-scope";
import { 
  getPendingPrompts, 
  markPromptShown, 
  dismissPrompt, 
  completePrompt,
  generateTradeClosePrompt,
  generateDailyReflectionPrompt,
  queuePrompt,
  autoQueueTradeClosePrompts,
  autoQueueStreakPrompts
} from '../lib/journal-prompts';

// ============================================================================
// Zod Schemas
// ============================================================================

const psychologySchema = z.object({
  mood: z.number().min(1).max(10),
  confidence: z.number().min(1).max(10),
  energy: z.number().min(1).max(10),
  focus: z.number().min(1).max(10),
  fear: z.number().min(1).max(10),
  greed: z.number().min(1).max(10),
  emotionalState: z.enum(['calm', 'anxious', 'excited', 'frustrated', 'neutral', 'stressed', 'confident']),
  notes: z.string().optional(),
  tradingEnvironment: z.enum(['home', 'office', 'traveling', 'mobile']).optional(),
  sleepQuality: z.number().min(1).max(10).optional(),
  distractions: z.boolean().optional(),
  marketCondition: z.enum(['trending', 'ranging', 'volatile', 'quiet', 'unsure']).optional(),
});

const journalEntryTypeValues = [
  'general',
  'daily',
  'weekly',
  'monthly',
  'trade_review',
  'strategy',
  'comparison',
  'backtest',
] as const;

const journalEntryTypeSchema = z.enum(journalEntryTypeValues);

const journalBlockPropsSchema = z.object({
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().optional(),
  imageCaption: z.string().optional(),
  imageWidth: z.number().optional(),
  videoUrl: z.string().optional(),
  videoThumbnail: z.string().optional(),
  videoDuration: z.number().optional(),
  videoCaption: z.string().optional(),
  videoAutoplay: z.boolean().optional(),
  videoMuted: z.boolean().optional(),
  calloutEmoji: z.string().optional(),
  calloutColor: z.string().optional(),
  calloutType: z.enum(['info', 'warning', 'success', 'error', 'note']).optional(),
  language: z.string().optional(),
  chartType: z.enum([
    'equity-curve',
    'drawdown',
    'daily-net',
    'performance-weekday',
    'performing-assets',
    'performance-heatmap',
    'streak-distribution',
    'r-multiple-distribution',
    'mae-mfe-scatter',
    'entry-exit-time',
  ]).optional(),
  chartConfig: z.object({
    accountId: z.string().optional(),
    accountIds: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
    showComparison: z.boolean().optional(),
    comparisonType: z.enum(['previous', 'account']).optional(),
    height: z.number().optional(),
    title: z.string().optional(),
    hideTitle: z.boolean().optional(),
  }).optional(),
  tradeId: z.string().optional(),
  tradeDisplay: z.enum(['card', 'inline', 'detailed']).optional(),
  tradeIds: z.array(z.string()).optional(),
  comparisonMetrics: z.array(z.string()).optional(),
  statType: z.string().optional(),
  accountId: z.string().optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  checked: z.boolean().optional(),
  tableData: z.object({
    rows: z.array(z.array(z.string())),
    headers: z.array(z.string()).optional(),
  }).optional(),
  psychologyData: psychologySchema.optional(),
}).optional();

const journalBlockSchema: z.ZodType<JournalBlock> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum([
      'paragraph',
      'heading1',
      'heading2',
      'heading3',
      'bulletList',
      'numberedList',
      'checkList',
      'quote',
      'callout',
      'divider',
      'code',
      'image',
      'video',
      'embed',
      'chart',
      'trade',
      'tradeComparison',
      'statCard',
      'table',
      'psychology',
    ]),
    content: z.string(),
    props: journalBlockPropsSchema,
    children: z.array(journalBlockSchema).optional(),
  })
);

function sqlStringList(values: string[]) {
  return sql.join(values.map((value) => sql`${value}`), sql`, `);
}

async function getJournalAccountScopeCondition(
  userId: string,
  accountId?: string
) {
  if (!accountId || isAllAccountsScope(accountId)) {
    return {
      condition: null,
      isEmpty: false,
    };
  }

  const scopedAccountIds = await resolveScopedAccountIds(userId, accountId);

  if (scopedAccountIds.length === 0) {
    return {
      condition: null,
      isEmpty: true,
    };
  }

  return {
    condition: sql`EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(${journalEntry.accountIds}, '[]'::jsonb)) AS account_scope(account_id)
      WHERE account_scope.account_id IN (${sqlStringList(scopedAccountIds)})
    )`,
    isEmpty: false,
  };
}

// ============================================================================
// Router
// ============================================================================

export const journalRouter = router({
  // ========================================
  // Journal Entries
  // ========================================

  /**
   * List journal entries with filtering and pagination
   */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
      entryType: journalEntryTypeSchema.optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      accountId: z.string().optional(),
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      tradePhase: z.enum(['pre-trade', 'during-trade', 'post-trade']).optional(),
      sortBy: z.enum(['createdAt', 'updatedAt', 'journalDate', 'title']).default('updatedAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const {
        limit = 20,
        cursor,
        entryType,
        search,
        tags,
        accountId,
        isPinned,
        isArchived = false,
        tradePhase,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
      } = input ?? {};

      const conditions = [
        eq(journalEntry.userId, ctx.session.user.id),
        eq(journalEntry.isArchived, isArchived),
      ];

      if (entryType) {
        conditions.push(eq(journalEntry.entryType, entryType));
      }

      if (isPinned !== undefined) {
        conditions.push(eq(journalEntry.isPinned, isPinned));
      }

      if (search) {
        conditions.push(ilike(journalEntry.title, `%${search}%`));
      }

      if (tradePhase) {
        conditions.push(eq(journalEntry.tradePhase, tradePhase));
      }

      if (accountId && !isAllAccountsScope(accountId)) {
        const { condition: accountScopeCondition, isEmpty } = await getJournalAccountScopeCondition(
          ctx.session.user.id,
          accountId
        );

        if (isEmpty) {
          return {
            items: [],
            nextCursor: undefined,
          };
        }

        if (accountScopeCondition) {
          conditions.push(accountScopeCondition);
        }
      }

      if (tags && tags.length > 0) {
        conditions.push(
          sql`EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(${journalEntry.tags}, '[]'::jsonb)) AS entry_tag(tag)
            WHERE entry_tag.tag IN (${sqlStringList(tags)})
          )`
        );
      }

      const sortColumn = {
        createdAt: journalEntry.createdAt,
        updatedAt: journalEntry.updatedAt,
        journalDate: journalEntry.journalDate,
        title: journalEntry.title,
      }[sortBy];

      const orderByClause = sortOrder === 'desc'
        ? [desc(journalEntry.isPinned), desc(sortColumn)]
        : [desc(journalEntry.isPinned), asc(sortColumn)];

      const entries = await db
        .select({
          id: journalEntry.id,
          title: journalEntry.title,
          emoji: journalEntry.emoji,
          coverImageUrl: journalEntry.coverImageUrl,
          entryType: journalEntry.entryType,
          tags: journalEntry.tags,
          journalDate: journalEntry.journalDate,
          isPinned: journalEntry.isPinned,
          wordCount: journalEntry.wordCount,
          readTimeMinutes: journalEntry.readTimeMinutes,
          createdAt: journalEntry.createdAt,
          updatedAt: journalEntry.updatedAt,
          content: journalEntry.content,
          tradePhase: journalEntry.tradePhase,
          psychology: journalEntry.psychology,
          plannedEntryPrice: journalEntry.plannedEntryPrice,
          plannedExitPrice: journalEntry.plannedExitPrice,
          plannedStopLoss: journalEntry.plannedStopLoss,
          plannedTakeProfit: journalEntry.plannedTakeProfit,
          plannedRiskReward: journalEntry.plannedRiskReward,
          actualOutcome: journalEntry.actualOutcome,
          actualPnl: journalEntry.actualPnl,
          actualPips: journalEntry.actualPips,
        })
        .from(journalEntry)
        .where(and(...conditions))
        .orderBy(...orderByClause)
        .limit(limit + 1);

      const processedEntries = entries.slice(0, limit).map((entry) => {
        const blocks = entry.content as JournalBlock[] | null;
        let preview = '';
        
        if (blocks && blocks.length > 0) {
          const firstTextBlock = blocks.find(
            (b) => b.type === 'paragraph' && b.content
          );
          if (firstTextBlock) {
            preview = firstTextBlock.content
              .replace(/<[^>]*>/g, '')
              .slice(0, 200);
          }
        }

        return {
          ...entry,
          preview,
          content: undefined,
        };
      });

      return {
        items: processedEntries,
        nextCursor: entries.length > limit ? entries[limit - 1]?.id : undefined,
      };
    }),

  /**
   * Get a single journal entry by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await db
        .select()
        .from(journalEntry)
        .where(and(
          eq(journalEntry.id, input.id),
          eq(journalEntry.userId, ctx.session.user.id)
        ))
        .limit(1);

      if (!entry) {
        throw new Error('Journal entry not found');
      }

      const images = await db
        .select()
        .from(journalImage)
        .where(eq(journalImage.entryId, input.id));

      const media = await db
        .select()
        .from(journalMedia)
        .where(eq(journalMedia.entryId, input.id));

      return {
        ...entry,
        images,
        media,
      };
    }),

  /**
   * Create a new journal entry
   */
  create: protectedProcedure
    .input(z.object({
      title: z.string().default('Untitled'),
      emoji: z.string().max(10).optional(),
      coverImageUrl: z.string().optional(),
      coverImagePosition: z.number().min(0).max(100).optional(),
      content: z.array(journalBlockSchema).optional(),
      accountIds: z.array(z.string()).optional(),
      linkedTradeIds: z.array(z.string()).optional(),
      entryType: journalEntryTypeSchema.optional(),
      tags: z.array(z.string()).optional(),
      journalDate: z.string().optional(),
      templateId: z.string().optional(),
      tradePhase: z.enum(['pre-trade', 'during-trade', 'post-trade']).optional(),
      psychology: psychologySchema.optional(),
      plannedEntryPrice: z.string().optional(),
      plannedExitPrice: z.string().optional(),
      plannedStopLoss: z.string().optional(),
      plannedTakeProfit: z.string().optional(),
      plannedRiskReward: z.string().optional(),
      plannedNotes: z.string().optional(),
      actualOutcome: z.enum(['win', 'loss', 'breakeven', 'scratched']).optional(),
      actualPnl: z.string().optional(),
      actualPips: z.string().optional(),
      postTradeAnalysis: z.string().optional(),
      lessonsLearned: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let content = input.content ?? [];

      if (input.templateId) {
        const [template] = await db
          .select()
          .from(journalTemplate)
          .where(and(
            eq(journalTemplate.id, input.templateId),
            or(
              eq(journalTemplate.userId, ctx.session.user.id),
              eq(journalTemplate.isSystem, true),
              eq(journalTemplate.isPublic, true)
            )
          ))
          .limit(1);

        if (template && template.content) {
          content = template.content as JournalBlock[];
          
          await db
            .update(journalTemplate)
            .set({ usageCount: sql`${journalTemplate.usageCount} + 1` })
            .where(eq(journalTemplate.id, input.templateId));
        }
      }

      const wordCount = calculateWordCount(content);
      const readTimeMinutes = Math.ceil(wordCount / 200);

      const [newEntry] = await db
        .insert(journalEntry)
        .values({
          userId: ctx.session.user.id,
          title: input.title,
          emoji: input.emoji,
          coverImageUrl: input.coverImageUrl,
          coverImagePosition: input.coverImagePosition ?? 50,
          content: content as any,
          accountIds: input.accountIds ?? [],
          linkedTradeIds: input.linkedTradeIds ?? [],
          entryType: input.entryType ?? 'general',
          tags: input.tags ?? [],
          journalDate: input.journalDate ? new Date(input.journalDate) : null,
          wordCount,
          readTimeMinutes,
          tradePhase: input.tradePhase,
          psychology: input.psychology as any,
          plannedEntryPrice: input.plannedEntryPrice,
          plannedExitPrice: input.plannedExitPrice,
          plannedStopLoss: input.plannedStopLoss,
          plannedTakeProfit: input.plannedTakeProfit,
          plannedRiskReward: input.plannedRiskReward,
          plannedNotes: input.plannedNotes,
          actualOutcome: input.actualOutcome,
          actualPnl: input.actualPnl,
          actualPips: input.actualPips,
          postTradeAnalysis: input.postTradeAnalysis,
          lessonsLearned: input.lessonsLearned,
        })
        .returning();

      return newEntry;
    }),

  /**
   * Update a journal entry
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      emoji: z.string().max(10).nullable().optional(),
      coverImageUrl: z.string().nullable().optional(),
      coverImagePosition: z.number().min(0).max(100).optional(),
      content: z.array(journalBlockSchema).optional(),
      accountIds: z.array(z.string()).optional(),
      linkedTradeIds: z.array(z.string()).optional(),
      entryType: journalEntryTypeSchema.optional(),
      tags: z.array(z.string()).optional(),
      journalDate: z.string().nullable().optional(),
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      tradePhase: z.enum(['pre-trade', 'during-trade', 'post-trade']).nullable().optional(),
      psychology: psychologySchema.nullable().optional(),
      plannedEntryPrice: z.string().nullable().optional(),
      plannedExitPrice: z.string().nullable().optional(),
      plannedStopLoss: z.string().nullable().optional(),
      plannedTakeProfit: z.string().nullable().optional(),
      plannedRiskReward: z.string().nullable().optional(),
      plannedNotes: z.string().nullable().optional(),
      actualOutcome: z.enum(['win', 'loss', 'breakeven', 'scratched']).nullable().optional(),
      actualPnl: z.string().nullable().optional(),
      actualPips: z.string().nullable().optional(),
      postTradeAnalysis: z.string().nullable().optional(),
      lessonsLearned: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      let wordCount: number | undefined;
      let readTimeMinutes: number | undefined;
      if (updates.content) {
        wordCount = calculateWordCount(updates.content);
        readTimeMinutes = Math.ceil(wordCount / 200);
      }

      const [updatedEntry] = await db
        .update(journalEntry)
        .set({
          ...updates,
          content: updates.content as any,
          psychology: updates.psychology as any,
          journalDate: updates.journalDate === null 
            ? null 
            : updates.journalDate 
              ? new Date(updates.journalDate) 
              : undefined,
          wordCount,
          readTimeMinutes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(journalEntry.id, id),
          eq(journalEntry.userId, ctx.session.user.id)
        ))
        .returning();

      if (!updatedEntry) {
        throw new Error('Journal entry not found');
      }

      return updatedEntry;
    }),

  /**
   * Delete a journal entry
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(journalEntry)
        .where(and(
          eq(journalEntry.id, input.id),
          eq(journalEntry.userId, ctx.session.user.id)
        ))
        .returning();

      if (!deleted) {
        throw new Error('Journal entry not found');
      }

      return { success: true };
    }),

  /**
   * Duplicate a journal entry
   */
  duplicate: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [original] = await db
        .select()
        .from(journalEntry)
        .where(and(
          eq(journalEntry.id, input.id),
          eq(journalEntry.userId, ctx.session.user.id)
        ))
        .limit(1);

      if (!original) {
        throw new Error('Journal entry not found');
      }

      const [duplicate] = await db
        .insert(journalEntry)
        .values({
          userId: ctx.session.user.id,
          title: input.title ?? `${original.title} (Copy)`,
          emoji: original.emoji,
          coverImageUrl: original.coverImageUrl,
          coverImagePosition: original.coverImagePosition,
          content: original.content,
          accountIds: original.accountIds,
          linkedTradeIds: original.linkedTradeIds,
          entryType: original.entryType,
          tags: original.tags,
          journalDate: original.journalDate,
          wordCount: original.wordCount,
          readTimeMinutes: original.readTimeMinutes,
        })
        .returning();

      return duplicate;
    }),

  // ========================================
  // Templates
  // ========================================

  /**
   * List templates (user's + system templates)
   */
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

      const templates = await db
        .select()
        .from(journalTemplate)
        .where(and(...conditions))
        .orderBy(desc(journalTemplate.isSystem), desc(journalTemplate.usageCount));

      return templates;
    }),

  /**
   * Create a template from content or existing entry
   */
  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      emoji: z.string().max(10).optional(),
      content: z.array(journalBlockSchema).optional(),
      fromEntryId: z.string().optional(), // Create from existing entry
      category: z.enum(['daily', 'weekly', 'trade_review', 'strategy', 'custom']).optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let content = input.content ?? [];

      // If creating from existing entry
      if (input.fromEntryId) {
        const [entry] = await db
          .select()
          .from(journalEntry)
          .where(and(
            eq(journalEntry.id, input.fromEntryId),
            eq(journalEntry.userId, ctx.session.user.id)
          ))
          .limit(1);

        if (entry && entry.content) {
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

  /**
   * Delete a template
   */
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(journalTemplate)
        .where(and(
          eq(journalTemplate.id, input.id),
          eq(journalTemplate.userId, ctx.session.user.id),
          eq(journalTemplate.isSystem, false) // Can't delete system templates
        ))
        .returning();

      if (!deleted) {
        throw new Error('Template not found or cannot be deleted');
      }

      return { success: true };
    }),

  // ========================================
  // Images
  // ========================================

  /**
   * Register an uploaded image
   */
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

  /**
   * Associate orphaned images with an entry
   */
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

  /**
   * Delete an image
   */
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

  // ========================================
  // Media (Images & Videos)
  // ========================================

  /**
   * Upload media (image or video) for a journal entry
   */
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

  /**
   * List media for a journal entry
   */
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

      const media = await db
        .select()
        .from(journalMedia)
        .where(and(...conditions))
        .orderBy(asc(journalMedia.sortOrder), desc(journalMedia.createdAt));

      return media;
    }),

  /**
   * Update media metadata
   */
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

  /**
   * Delete media
   */
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

  // ========================================
  // Trade Media
  // ========================================

  /**
   * Upload media for a trade
   */
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

  /**
   * List media for a trade
   */
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

      const media = await db
        .select()
        .from(tradeMedia)
        .where(and(...conditions))
        .orderBy(asc(tradeMedia.sortOrder), desc(tradeMedia.createdAt));

      return media;
    }),

  /**
   * Update trade media
   */
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

  /**
   * Delete trade media
   */
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

  // ========================================
  // Stats & Analytics
  // ========================================

  /**
   * Get journal statistics
   */
  stats: protectedProcedure
    .input(
      z
        .object({
          accountId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
    const { condition: accountScopeCondition, isEmpty } = await getJournalAccountScopeCondition(
      ctx.session.user.id,
      input?.accountId
    );

    if (isEmpty) {
      return {
        totalEntries: 0,
        totalWords: 0,
        pinnedCount: 0,
        archivedCount: 0,
        typeBreakdown: [],
        recentActivity: [],
      };
    }

    const baseConditions = [eq(journalEntry.userId, ctx.session.user.id)];

    if (accountScopeCondition) {
      baseConditions.push(accountScopeCondition);
    }

    const activeConditions = [
      eq(journalEntry.userId, ctx.session.user.id),
      eq(journalEntry.isArchived, false),
    ];

    if (accountScopeCondition) {
      activeConditions.push(accountScopeCondition);
    }

    const [stats] = await db
      .select({
        totalEntries: sql<number>`count(*)::int`,
        totalWords: sql<number>`coalesce(sum(${journalEntry.wordCount}), 0)::int`,
        pinnedCount: sql<number>`sum(case when ${journalEntry.isPinned} then 1 else 0 end)::int`,
        archivedCount: sql<number>`sum(case when ${journalEntry.isArchived} then 1 else 0 end)::int`,
      })
      .from(journalEntry)
      .where(and(...baseConditions));

    // Get entry type breakdown
    const typeBreakdown = await db
      .select({
        entryType: journalEntry.entryType,
        count: sql<number>`count(*)::int`,
      })
      .from(journalEntry)
      .where(and(...activeConditions))
      .groupBy(journalEntry.entryType);

    // Get recent activity (entries per week for last 8 weeks)
    const recentActivity = await db
      .select({
        week: sql<string>`to_char(${journalEntry.createdAt}, 'IYYY-IW')`,
        count: sql<number>`count(*)::int`,
      })
      .from(journalEntry)
      .where(and(
        ...activeConditions,
        sql`${journalEntry.createdAt} > now() - interval '8 weeks'`
      ))
      .groupBy(sql`to_char(${journalEntry.createdAt}, 'IYYY-IW')`)
      .orderBy(sql`to_char(${journalEntry.createdAt}, 'IYYY-IW')`);

    return {
      ...stats,
      typeBreakdown,
      recentActivity,
    };
  }),

  /**
   * Get entries for calendar view
   */
  calendarEntries: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      accountId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { condition: accountScopeCondition, isEmpty } = await getJournalAccountScopeCondition(
        ctx.session.user.id,
        input.accountId
      );

      if (isEmpty) {
        return [];
      }

      const conditions = [
        eq(journalEntry.userId, ctx.session.user.id),
        eq(journalEntry.isArchived, false),
        sql`coalesce(${journalEntry.journalDate}, ${journalEntry.createdAt}) between ${input.startDate}::timestamp and ${input.endDate}::timestamp`,
      ];

      if (accountScopeCondition) {
        conditions.push(accountScopeCondition);
      }

      const entries = await db
        .select({
          id: journalEntry.id,
          title: journalEntry.title,
          emoji: journalEntry.emoji,
          entryType: journalEntry.entryType,
          journalDate: journalEntry.journalDate,
          createdAt: journalEntry.createdAt,
        })
        .from(journalEntry)
        .where(and(...conditions))
        .orderBy(sql`coalesce(${journalEntry.journalDate}, ${journalEntry.createdAt})`);

      return entries;
    }),

  // ========================================
  // Goal Linking
  // ========================================

  linkGoal: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      goalId: z.string(),
      context: z.string().optional(),
      contribution: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [goalData] = await db
        .select()
        .from(goal)
        .where(and(
          eq(goal.id, input.goalId),
          eq(goal.userId, ctx.session.user.id)
        ))
        .limit(1);

      if (!goalData) {
        throw new Error('Goal not found');
      }

      const [entry] = await db
        .select()
        .from(journalEntry)
        .where(and(
          eq(journalEntry.id, input.entryId),
          eq(journalEntry.userId, ctx.session.user.id)
        ))
        .limit(1);

      if (!entry) {
        throw new Error('Journal entry not found');
      }

      await db
        .insert(journalEntryGoal)
        .values({
          entryId: input.entryId,
          goalId: input.goalId,
          context: input.context,
          contribution: input.contribution?.toString(),
        })
        .onConflictDoNothing();

      const currentGoalIds = (entry.linkedGoalIds as string[]) || [];
      if (!currentGoalIds.includes(input.goalId)) {
        await db
          .update(journalEntry)
          .set({
            linkedGoalIds: [...currentGoalIds, input.goalId],
            updatedAt: new Date(),
          })
          .where(eq(journalEntry.id, input.entryId));
      }

      return { success: true };
    }),

  unlinkGoal: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      goalId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await db
        .select()
        .from(journalEntry)
        .where(and(
          eq(journalEntry.id, input.entryId),
          eq(journalEntry.userId, ctx.session.user.id)
        ))
        .limit(1);

      if (!entry) {
        throw new Error('Journal entry not found');
      }

      await db
        .delete(journalEntryGoal)
        .where(and(
          eq(journalEntryGoal.entryId, input.entryId),
          eq(journalEntryGoal.goalId, input.goalId)
        ));

      const currentGoalIds = (entry.linkedGoalIds as string[]) || [];
      const newGoalIds = currentGoalIds.filter(id => id !== input.goalId);
      
      await db
        .update(journalEntry)
        .set({
          linkedGoalIds: newGoalIds,
          updatedAt: new Date(),
        })
        .where(eq(journalEntry.id, input.entryId));

      return { success: true };
    }),

  getEntryGoals: protectedProcedure
    .input(z.object({ entryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const goalLinks = await db
        .select({
          id: journalEntryGoal.id,
          goalId: journalEntryGoal.goalId,
          context: journalEntryGoal.context,
          contribution: journalEntryGoal.contribution,
          createdAt: journalEntryGoal.createdAt,
          goal: goal,
        })
        .from(journalEntryGoal)
        .innerJoin(goal, eq(journalEntryGoal.goalId, goal.id))
        .where(eq(journalEntryGoal.entryId, input.entryId));

      return goalLinks;
    }),

  // ========================================
  // Full-Text Search
  // ========================================

  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      entryType: journalEntryTypeSchema.optional(),
      accountId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(journalEntry.userId, ctx.session.user.id),
        eq(journalEntry.isArchived, false),
        or(
          ilike(journalEntry.title, `%${input.query}%`),
          ilike(journalEntry.plainTextContent, `%${input.query}%`)
        ),
      ];

      if (input.entryType) {
        conditions.push(eq(journalEntry.entryType, input.entryType));
      }

      if (input.accountId && !isAllAccountsScope(input.accountId)) {
        const { condition: accountScopeCondition, isEmpty } =
          await getJournalAccountScopeCondition(
            ctx.session.user.id,
            input.accountId
          );

        if (isEmpty) {
          return [];
        }

        if (accountScopeCondition) {
          conditions.push(accountScopeCondition);
        }
      }

      const results = await db
        .select({
          id: journalEntry.id,
          title: journalEntry.title,
          emoji: journalEntry.emoji,
          entryType: journalEntry.entryType,
          journalDate: journalEntry.journalDate,
          aiSummary: journalEntry.aiSummary,
          plainTextContent: journalEntry.plainTextContent,
          updatedAt: journalEntry.updatedAt,
        })
        .from(journalEntry)
        .where(and(...conditions))
        .orderBy(desc(journalEntry.updatedAt))
        .limit(input.limit);

      const highlightedResults = results.map(r => {
        let highlightedText = r.plainTextContent || '';
        if (highlightedText) {
          const regex = new RegExp(`(${input.query})`, 'gi');
          highlightedText = highlightedText.replace(regex, '**$1**');
          if (highlightedText.length > 300) {
            const matchIndex = highlightedText.toLowerCase().indexOf(input.query.toLowerCase());
            const start = Math.max(0, matchIndex - 100);
            const end = Math.min(highlightedText.length, matchIndex + input.query.length + 200);
            highlightedText = (start > 0 ? '...' : '') + highlightedText.slice(start, end) + (end < highlightedText.length ? '...' : '');
          }
        }
        
        return {
          ...r,
          highlightedText,
        };
      });

      return highlightedResults;
    }),

  // ========================================
  // AI Analysis
  // ========================================

  analyzeEntry: protectedProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await db
        .select()
        .from(journalEntry)
        .where(and(
          eq(journalEntry.id, input.entryId),
          eq(journalEntry.userId, ctx.session.user.id)
        ))
        .limit(1);

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Journal entry not found',
        });
      }

      try {
        return await generateJournalSummary(input.entryId);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to analyze journal entry';

        if (message === 'Add some journal content before running AI analysis') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message,
          });
        }

        if (message === 'Journal entry not found') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  analyzePatterns: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string()).optional(),
      limit: z.number().min(3).max(20).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      let entryIds = input.entryIds;
      
      if (!entryIds || entryIds.length === 0) {
        const entries = await db
          .select({ id: journalEntry.id })
          .from(journalEntry)
          .where(eq(journalEntry.userId, ctx.session.user.id))
          .orderBy(desc(journalEntry.updatedAt))
          .limit(input.limit);
        
        entryIds = entries.map(e => e.id);
      }

      if (entryIds.length < 3) {
        throw new Error('Need at least 3 entries to analyze patterns');
      }

      const patterns = await extractPatternsFromEntries(
        ctx.session.user.id,
        entryIds
      );
      
      return patterns;
    }),

  askJournal: protectedProcedure
    .input(z.object({
      question: z.string().min(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await generateJournalContextQuery(input.question, ctx.session.user.id);
      
      return result;
    }),

  // ========================================
  // Psychology Correlations
  // ========================================

  getPsychologyCorrelations: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
      forceRecalculate: z.boolean().optional(),
      periodDays: z.number().min(7).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      if (input.forceRecalculate) {
        const correlations = await calculatePsychologyCorrelations(
          ctx.session.user.id,
          input.accountId,
          input.periodDays
        );
        return correlations;
      }

      const cached = await getCachedCorrelations(ctx.session.user.id, input.accountId);
      
      if (cached.length === 0) {
        const correlations = await calculatePsychologyCorrelations(
          ctx.session.user.id,
          input.accountId,
          input.periodDays
        );
        return correlations;
      }

      return cached;
    }),

  getOptimalTradingConditions: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const result = await getBestTradingConditions(ctx.session.user.id, input.accountId);
      return result;
    }),

  // ========================================
  // Journal Prompts
  // ========================================

  getPrompts: protectedProcedure
    .query(async ({ ctx }) => {
      const prompts = await getPendingPrompts(ctx.session.user.id);
      return prompts;
    }),

  showPrompt: protectedProcedure
    .input(z.object({ promptId: z.string() }))
    .mutation(async ({ input }) => {
      await markPromptShown(input.promptId);
      return { success: true };
    }),

  dismissPrompt: protectedProcedure
    .input(z.object({ promptId: z.string() }))
    .mutation(async ({ input }) => {
      await dismissPrompt(input.promptId);
      return { success: true };
    }),

  completePrompt: protectedProcedure
    .input(z.object({
      promptId: z.string(),
      resultingEntryId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await completePrompt(input.promptId, input.resultingEntryId);
      return { success: true };
    }),

  generateTradePrompt: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const prompt = await generateTradeClosePrompt(input.tradeId);
      
      if (!prompt) {
        throw new Error('Failed to generate prompt');
      }

      const promptId = await queuePrompt(ctx.session.user.id, prompt, 'trade_close', {
        tradeId: input.tradeId
      });

      return { id: promptId, ...prompt };
    }),

  generateDailyPrompt: protectedProcedure
    .mutation(async ({ ctx }) => {
      const prompt = await generateDailyReflectionPrompt();
      
      const promptId = await queuePrompt(ctx.session.user.id, prompt, 'schedule', {
        type: 'daily'
      });

      return { id: promptId, ...prompt };
    }),

  autoGeneratePrompts: protectedProcedure
    .mutation(async ({ ctx }) => {
      await autoQueueTradeClosePrompts(ctx.session.user.id);
      await autoQueueStreakPrompts(ctx.session.user.id);

      const prompts = await getPendingPrompts(ctx.session.user.id);
      return prompts;
    }),

  /**
   * Auto-generate a journal entry from recent trades
   * Creates a structured entry with trade summaries, observations, and reflection prompts
   */
  autoGenerateEntry: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        date: z.string().optional(), // ISO date, defaults to today
        tradeIds: z.array(z.string()).optional(), // Specific trades, or auto-select today's
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const targetDate = input.date ? new Date(input.date) : new Date();
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Get trades for the day (or specific trades)
      const { trade: tradeTable } = await import("../db/schema/trading");
      const { gte, lte } = await import("drizzle-orm");

      let trades;
      if (input.tradeIds && input.tradeIds.length > 0) {
        trades = await db
          .select()
          .from(tradeTable)
          .where(
            and(
              eq(tradeTable.accountId, input.accountId),
              inArray(tradeTable.id, input.tradeIds)
            )
          );
      } else {
        trades = await db
          .select()
          .from(tradeTable)
          .where(
            and(
              eq(tradeTable.accountId, input.accountId),
              gte(tradeTable.openTime, dayStart),
              lte(tradeTable.openTime, dayEnd)
            )
          );
      }

      if (trades.length === 0) {
        throw new Error("No trades found for this period");
      }

      // Compute summary stats
      const totalPnl = trades.reduce((s, t) => s + parseFloat(t.profit?.toString() || "0"), 0);
      const winners = trades.filter((t) => parseFloat(t.profit?.toString() || "0") > 0);
      const losers = trades.filter((t) => parseFloat(t.profit?.toString() || "0") < 0);
      const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
      const bestTrade = trades.reduce((best, t) => {
        const pnl = parseFloat(t.profit?.toString() || "0");
        return pnl > parseFloat(best.profit?.toString() || "0") ? t : best;
      }, trades[0]);
      const worstTrade = trades.reduce((worst, t) => {
        const pnl = parseFloat(t.profit?.toString() || "0");
        return pnl < parseFloat(worst.profit?.toString() || "0") ? t : worst;
      }, trades[0]);

      // Build journal blocks
      const dateStr = targetDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const blocks: JournalBlock[] = [
        {
          id: crypto.randomUUID(),
          type: "heading2",
          content: `Trading Session - ${dateStr}`,
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: `<strong>${trades.length}</strong> trades | <strong>${winRate.toFixed(0)}%</strong> win rate | Net P&L: <strong style="color: ${totalPnl >= 0 ? '#22c55e' : '#ef4444'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</strong>`,
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: "heading3",
          content: "Trade Summary",
          children: [],
        },
      ];

      // Add each trade as a summary block
      for (const t of trades) {
        const pnl = parseFloat(t.profit?.toString() || "0");
        const rr = parseFloat(t.realisedRR?.toString() || "0");
        blocks.push({
          id: crypto.randomUUID(),
          type: "paragraph",
          content: `<strong>${t.symbol}</strong> ${t.tradeType?.toUpperCase()} — ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${rr >= 0 ? "+" : ""}${rr.toFixed(2)}R) | ${t.sessionTag || "No session"} | ${t.modelTag || "No model"}`,
          children: [],
        });
      }

      // Observations section
      blocks.push(
        {
          id: crypto.randomUUID(),
          type: "heading3",
          content: "Key Observations",
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: "callout",
          props: { calloutEmoji: "✅", calloutType: "success" },
          content: `Best trade: ${bestTrade.symbol} ${bestTrade.tradeType?.toUpperCase()} (+$${parseFloat(bestTrade.profit?.toString() || "0").toFixed(2)})`,
          children: [],
        },
      );

      if (losers.length > 0) {
        blocks.push({
          id: crypto.randomUUID(),
          type: "callout",
          props: { calloutEmoji: "⚠️", calloutType: "warning" },
          content: `Worst trade: ${worstTrade.symbol} ${worstTrade.tradeType?.toUpperCase()} ($${parseFloat(worstTrade.profit?.toString() || "0").toFixed(2)})`,
          children: [],
        });
      }

      // Reflection prompts
      blocks.push(
        {
          id: crypto.randomUUID(),
          type: "heading3",
          content: "Reflection",
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: "bulletList",
          content: "What went well today?",
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: "bulletList",
          content: "What could I have done better?",
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: "bulletList",
          content: "Did I follow my trading rules?",
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: "bulletList",
          content: "What will I focus on tomorrow?",
          children: [],
        },
      );

      // Create the entry
      const title = `${totalPnl >= 0 ? "📈" : "📉"} ${dateStr} — ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`;
      const plainText = blocks
        .map((b) => (b.content || "").replace(/<[^>]*>/g, ""))
        .join(" ");
      const wordCount = calculateWordCount(blocks);

      const [entry] = await db
        .insert(journalEntry)
        .values({
          userId,
          title,
          emoji: totalPnl >= 0 ? "📈" : "📉",
          content: blocks,
          accountIds: [input.accountId],
          linkedTradeIds: trades.map((t) => t.id),
          entryType: "daily",
          tags: ["auto-generated", "daily-review"],
          plainTextContent: plainText,
          journalDate: targetDate,
          wordCount,
          readTimeMinutes: Math.ceil(wordCount / 200),
          tradePhase: "post-trade",
        })
        .returning();

      return entry;
    }),

  /**
   * Generate a weekly or monthly review journal entry
   * Summarizes trading performance for the period with key metrics and reflection prompts
   */
  generatePeriodReview: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        period: z.enum(["week", "month"]),
        endDate: z.string().optional(), // ISO date, defaults to today
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const end = input.endDate ? new Date(input.endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      if (input.period === "week") {
        start.setDate(start.getDate() - 7);
      } else {
        start.setMonth(start.getMonth() - 1);
      }
      start.setHours(0, 0, 0, 0);

      const { trade: tradeTable } = await import("../db/schema/trading");
      const { gte, lte } = await import("drizzle-orm");

      const trades = await db
        .select()
        .from(tradeTable)
        .where(
          and(
            eq(tradeTable.accountId, input.accountId),
            gte(tradeTable.openTime, start),
            lte(tradeTable.openTime, end)
          )
        );

      if (trades.length === 0) {
        throw new Error("No trades found for this period");
      }

      // Period stats
      const pnls = trades.map((t) => parseFloat(t.profit?.toString() || "0"));
      const totalPnl = pnls.reduce((s, p) => s + p, 0);
      const wins = pnls.filter((p) => p > 0);
      const losses = pnls.filter((p) => p < 0);
      const winRate = (wins.length / trades.length) * 100;
      const grossWin = wins.reduce((s, p) => s + p, 0);
      const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
      const pf = grossLoss > 0 ? grossWin / grossLoss : 0;
      const rrs = trades.map((t) => parseFloat(t.realisedRR?.toString() || "0")).filter((r) => r !== 0);
      const avgRR = rrs.length > 0 ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;

      // Daily breakdown
      const dailyPnls: Record<string, number> = {};
      for (const t of trades) {
        if (!t.openTime) continue;
        const day = new Date(t.openTime).toISOString().split("T")[0];
        dailyPnls[day] = (dailyPnls[day] || 0) + parseFloat(t.profit?.toString() || "0");
      }
      const greenDays = Object.values(dailyPnls).filter((p) => p > 0).length;
      const totalDays = Object.keys(dailyPnls).length;

      // Symbol breakdown
      const symbolStats: Record<string, { count: number; pnl: number }> = {};
      for (const t of trades) {
        const sym = t.symbol || "unknown";
        if (!symbolStats[sym]) symbolStats[sym] = { count: 0, pnl: 0 };
        symbolStats[sym].count++;
        symbolStats[sym].pnl += parseFloat(t.profit?.toString() || "0");
      }
      const topSymbol = Object.entries(symbolStats).sort((a, b) => b[1].pnl - a[1].pnl)[0];
      const worstSymbol = Object.entries(symbolStats).sort((a, b) => a[1].pnl - b[1].pnl)[0];

      const periodLabel = input.period === "week" ? "Weekly" : "Monthly";
      const dateRange = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      const blocks: JournalBlock[] = [
        { id: crypto.randomUUID(), type: "heading2", content: `${periodLabel} Review: ${dateRange}`, children: [] },
        { id: crypto.randomUUID(), type: "paragraph", content: `<strong>${trades.length}</strong> trades over <strong>${totalDays}</strong> trading days`, children: [] },

        // Scorecard
        { id: crypto.randomUUID(), type: "heading3", content: "Performance Scorecard", children: [] },
        { id: crypto.randomUUID(), type: "paragraph", content: `<strong>Net P&L:</strong> <span style="color:${totalPnl >= 0 ? '#22c55e' : '#ef4444'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</span>`, children: [] },
        { id: crypto.randomUUID(), type: "paragraph", content: `<strong>Win Rate:</strong> ${winRate.toFixed(1)}% (${wins.length}W / ${losses.length}L)`, children: [] },
        { id: crypto.randomUUID(), type: "paragraph", content: `<strong>Profit Factor:</strong> ${pf.toFixed(2)} | <strong>Avg R:R:</strong> ${avgRR.toFixed(2)}`, children: [] },
        { id: crypto.randomUUID(), type: "paragraph", content: `<strong>Green Days:</strong> ${greenDays}/${totalDays} (${totalDays > 0 ? ((greenDays / totalDays) * 100).toFixed(0) : 0}%)`, children: [] },

        // Symbols
        { id: crypto.randomUUID(), type: "heading3", content: "Symbol Breakdown", children: [] },
      ];

      if (topSymbol) {
        blocks.push({ id: crypto.randomUUID(), type: "callout", props: { calloutEmoji: "🏆", calloutType: "success" }, content: `Best: ${topSymbol[0]} — +$${topSymbol[1].pnl.toFixed(2)} (${topSymbol[1].count} trades)`, children: [] });
      }
      if (worstSymbol && worstSymbol[1].pnl < 0) {
        blocks.push({ id: crypto.randomUUID(), type: "callout", props: { calloutEmoji: "⚠️", calloutType: "warning" }, content: `Worst: ${worstSymbol[0]} — $${worstSymbol[1].pnl.toFixed(2)} (${worstSymbol[1].count} trades)`, children: [] });
      }

      // Reflection
      blocks.push(
        { id: crypto.randomUUID(), type: "heading3", content: "Reflection", children: [] },
        { id: crypto.randomUUID(), type: "bulletList", content: `What was my biggest win this ${input.period}?`, children: [] },
        { id: crypto.randomUUID(), type: "bulletList", content: "What patterns did I notice in my losing trades?", children: [] },
        { id: crypto.randomUUID(), type: "bulletList", content: "Did I stick to my rules and edge conditions?", children: [] },
        { id: crypto.randomUUID(), type: "bulletList", content: `What is my #1 focus for next ${input.period}?`, children: [] },
        { id: crypto.randomUUID(), type: "bulletList", content: "Rate my discipline this period: /10", children: [] },
      );

      // Goals for next period
      blocks.push(
        { id: crypto.randomUUID(), type: "heading3", content: `Goals for Next ${periodLabel.replace("ly", "")}`, children: [] },
        { id: crypto.randomUUID(), type: "numberedList", content: " ", children: [] },
        { id: crypto.randomUUID(), type: "numberedList", content: " ", children: [] },
        { id: crypto.randomUUID(), type: "numberedList", content: " ", children: [] },
      );

      const title = `${totalPnl >= 0 ? "📈" : "📉"} ${periodLabel} Review: ${dateRange} — ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`;
      const plainText = blocks.map((b) => (b.content || "").replace(/<[^>]*>/g, "")).join(" ");
      const wordCount = calculateWordCount(blocks);

      const [entry] = await db
        .insert(journalEntry)
        .values({
          userId,
          title,
          emoji: totalPnl >= 0 ? "📈" : "📉",
          content: blocks,
          accountIds: [input.accountId],
          linkedTradeIds: trades.map((t) => t.id),
          entryType: input.period === "week" ? "weekly" : "monthly",
          tags: ["auto-generated", `${input.period}ly-review`],
          plainTextContent: plainText,
          journalDate: end,
          wordCount,
          readTimeMinutes: Math.ceil(wordCount / 200),
          tradePhase: "post-trade",
        })
        .returning();

      return entry;
    }),
});

// ============================================================================
// Helpers
// ============================================================================

function calculateWordCount(blocks: JournalBlock[]): number {
  let count = 0;
  
  function countBlock(block: JournalBlock) {
    if (block.content) {
      // Strip HTML tags and count words
      const text = block.content.replace(/<[^>]*>/g, '');
      const words = text.trim().split(/\s+/).filter(Boolean);
      count += words.length;
    }
    
    if (block.children) {
      block.children.forEach(countBlock);
    }
  }
  
  blocks.forEach(countBlock);
  return count;
}
