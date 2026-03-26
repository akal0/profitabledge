import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../db';
import {
  journalEntry,
  journalEntryGoal,
  journalImage,
  journalMedia,
  journalShare,
  journalShareEntry,
  journalShareViewer,
  journalTemplate,
  type JournalBlock,
} from '../../db/schema/journal';
import { goal } from '../../db/schema/trading';
import { parseNaturalJournalCapture } from '../../lib/journal-ai-capture';
import {
  ensureActivationMilestone,
  recordAppEvent,
} from '../../lib/ops/event-log';
import { protectedProcedure } from '../../lib/trpc';
import { isAllAccountsScope } from '../../lib/account-scope';
import {
  calculateWordCount,
  getJournalAccountScopeCondition,
  journalBlockSchema,
  journalEntryTypeSchema,
  psychologySchema,
  sqlStringList,
} from './shared';

const tradePhaseSchema = z.enum(['pre-trade', 'during-trade', 'post-trade']);

const journalAICaptureResultSchema = z.object({
  title: z.string(),
  journalDate: z.string().nullable(),
  tags: z.array(z.string()),
  entryType: journalEntryTypeSchema.nullable(),
  tradePhase: tradePhaseSchema.nullable(),
  psychology: psychologySchema.partial().nullable(),
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
  transcript: z.string().nullable().optional(),
  contentBlocks: z.array(journalBlockSchema),
});

function buildJournalListPreview(blocks: JournalBlock[] | null | undefined) {
  if (!blocks || blocks.length === 0) {
    return "";
  }

  const firstTextBlock = blocks.find(
    (block) => block.type === "paragraph" && block.content
  );

  return firstTextBlock
    ? firstTextBlock.content.replace(/<[^>]*>/g, "").slice(0, 200)
    : "";
}

function getSortableTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function compareJournalListItems(
  a: {
    isPinned: boolean | null;
    title: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    journalDate?: Date | string | null;
  },
  b: {
    isPinned: boolean | null;
    title: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    journalDate?: Date | string | null;
  },
  sortBy: "createdAt" | "updatedAt" | "journalDate" | "title",
  sortOrder: "asc" | "desc"
) {
  const pinnedDelta = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
  if (pinnedDelta !== 0) {
    return pinnedDelta;
  }

  if (sortBy === "title") {
    const titleDelta = a.title.localeCompare(b.title, undefined, {
      sensitivity: "base",
    });

    if (titleDelta !== 0) {
      return sortOrder === "asc" ? titleDelta : -titleDelta;
    }
  } else {
    const aValue =
      sortBy === "createdAt"
        ? getSortableTimestamp(a.createdAt)
        : sortBy === "updatedAt"
          ? getSortableTimestamp(a.updatedAt)
          : getSortableTimestamp(a.journalDate);
    const bValue =
      sortBy === "createdAt"
        ? getSortableTimestamp(b.createdAt)
        : sortBy === "updatedAt"
          ? getSortableTimestamp(b.updatedAt)
          : getSortableTimestamp(b.journalDate);

    if (aValue !== bValue) {
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    }
  }

  return getSortableTimestamp(b.updatedAt) - getSortableTimestamp(a.updatedAt);
}

export const journalEntryProcedures = {
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
      entryType: journalEntryTypeSchema.optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      accountId: z.string().optional(),
      linkedEdgeId: z.string().optional(),
      linkedMissedTradeId: z.string().optional(),
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      includeShared: z.boolean().optional(),
      tradePhase: z.enum(['pre-trade', 'during-trade', 'post-trade']).optional(),
      sortBy: z.enum(['createdAt', 'updatedAt', 'journalDate', 'title']).default('updatedAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const {
        limit = 20,
        entryType,
        search,
        tags,
        accountId,
        linkedEdgeId,
        linkedMissedTradeId,
        isPinned,
        isArchived = false,
        includeShared = false,
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

      if (linkedEdgeId) {
        conditions.push(eq(journalEntry.linkedEdgeId, linkedEdgeId));
      }

      if (linkedMissedTradeId) {
        conditions.push(eq(journalEntry.linkedMissedTradeId, linkedMissedTradeId));
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

      const ownFetchLimit = includeShared
        ? Math.min(Math.max(limit * 3, 60), 100)
        : limit + 1;

      const entries = await db
        .select({
          id: journalEntry.id,
          title: journalEntry.title,
          emoji: journalEntry.emoji,
          coverImageUrl: journalEntry.coverImageUrl,
          coverImagePosition: journalEntry.coverImagePosition,
          entryType: journalEntry.entryType,
          tags: journalEntry.tags,
          journalDate: journalEntry.journalDate,
          isPinned: journalEntry.isPinned,
          wordCount: journalEntry.wordCount,
          readTimeMinutes: journalEntry.readTimeMinutes,
          linkedEdgeId: journalEntry.linkedEdgeId,
          linkedMissedTradeId: journalEntry.linkedMissedTradeId,
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
        .limit(ownFetchLimit);

      const processedEntries = entries
        .slice(0, includeShared ? entries.length : limit)
        .map((entry) => {
        const blocks = entry.content as JournalBlock[] | null;
        const preview = buildJournalListPreview(blocks);

        return {
          ...entry,
          preview,
          content: undefined,
          isShared: false,
        };
      });

      let sharedEntries: Array<{
        id: string;
        title: string;
        emoji: string | null;
        coverImageUrl: string | null;
        coverImagePosition: number | null;
        entryType: string | null;
        tags: string[] | null;
        journalDate: Date | string | null;
        isPinned: boolean | null;
        wordCount: number | null;
        readTimeMinutes: number | null;
        linkedEdgeId: string | null;
        linkedMissedTradeId: string | null;
        createdAt: Date | string;
        updatedAt: Date | string;
        preview: string;
        isShared: true;
        shareToken: string;
        shareName: string;
      }> = [];

      if (includeShared && !isArchived && isPinned !== true) {
        const sharedRows = await db
          .select({
            shareToken: journalShare.shareToken,
            shareName: journalShare.name,
            entry: journalEntry,
          })
          .from(journalShareViewer)
          .innerJoin(journalShare, eq(journalShare.id, journalShareViewer.shareId))
          .innerJoin(journalShareEntry, eq(journalShareEntry.shareId, journalShare.id))
          .innerJoin(journalEntry, eq(journalEntry.id, journalShareEntry.journalEntryId))
          .where(
            and(
              eq(journalShareViewer.viewerUserId, ctx.session.user.id),
              eq(journalShareViewer.status, "approved"),
              eq(journalShare.isActive, true)
            )
          )
          .orderBy(desc(journalEntry.updatedAt))
          .limit(ownFetchLimit);

        const dedupedSharedEntries = new Map<string, (typeof sharedRows)[number]>();
        for (const row of sharedRows) {
          if (!dedupedSharedEntries.has(row.entry.id)) {
            dedupedSharedEntries.set(row.entry.id, row);
          }
        }

        sharedEntries = Array.from(dedupedSharedEntries.values())
          .filter(({ entry }) => {
            if (entryType && entry.entryType !== entryType) {
              return false;
            }

            if (
              search &&
              !entry.title.toLowerCase().includes(search.toLowerCase())
            ) {
              return false;
            }

            if (linkedEdgeId && entry.linkedEdgeId !== linkedEdgeId) {
              return false;
            }

            if (
              linkedMissedTradeId &&
              entry.linkedMissedTradeId !== linkedMissedTradeId
            ) {
              return false;
            }

            if (tradePhase && entry.tradePhase !== tradePhase) {
              return false;
            }

            if (tags?.length) {
              const entryTags = (entry.tags as string[] | null) ?? [];
              const tagSet = new Set(entryTags);
              if (!tags.some((tag) => tagSet.has(tag))) {
                return false;
              }
            }

            return true;
          })
          .map(({ entry, shareName, shareToken }) => ({
            id: entry.id,
            title: entry.title,
            emoji: entry.emoji,
            coverImageUrl: entry.coverImageUrl,
            coverImagePosition: entry.coverImagePosition,
            entryType: entry.entryType,
            tags: (entry.tags as string[] | null) ?? [],
            journalDate: entry.journalDate,
            isPinned: false,
            wordCount: entry.wordCount,
            readTimeMinutes: entry.readTimeMinutes,
            linkedEdgeId: entry.linkedEdgeId,
            linkedMissedTradeId: entry.linkedMissedTradeId,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            preview: buildJournalListPreview(entry.content as JournalBlock[] | null),
            isShared: true as const,
            shareToken,
            shareName,
          }));
      }

      const mergedEntries = includeShared
        ? [...processedEntries, ...sharedEntries]
            .sort((a, b) => compareJournalListItems(a, b, sortBy, sortOrder))
            .slice(0, limit)
        : processedEntries;

      return {
        items: mergedEntries,
        nextCursor:
          includeShared || entries.length <= limit
            ? undefined
            : entries[limit - 1]?.id,
      };
    }),

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

  create: protectedProcedure
    .input(z.object({
      title: z.string().default('Untitled'),
      emoji: z.string().max(10).optional(),
      coverImageUrl: z.string().optional(),
      coverImagePosition: z.number().min(0).max(100).optional(),
      content: z.array(journalBlockSchema).optional(),
      accountIds: z.array(z.string()).optional(),
      linkedTradeIds: z.array(z.string()).optional(),
      linkedEdgeId: z.string().optional(),
      linkedMissedTradeId: z.string().optional(),
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
          linkedEdgeId: input.linkedEdgeId ?? null,
          linkedMissedTradeId: input.linkedMissedTradeId ?? null,
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

      await Promise.all([
        ensureActivationMilestone({
          userId: ctx.session.user.id,
          key: "journal_entry_created",
          source: "server",
          metadata: {
            entryId: newEntry.id,
            entryType: newEntry.entryType,
          },
        }),
        recordAppEvent({
          userId: ctx.session.user.id,
          category: "journal",
          name: "journal.entry.created",
          source: "server",
          summary: newEntry.title,
          metadata: {
            entryId: newEntry.id,
            entryType: newEntry.entryType,
          },
        }),
      ]);

      return newEntry;
    }),

  parseNaturalCapture: protectedProcedure
    .input(
      z.object({
        text: z.string().trim().max(1500).optional().default(""),
        accountId: z.string().optional(),
        videoUrl: z.string().url().optional(),
        videoName: z.string().optional(),
        videoMimeType: z.string().optional(),
      }).refine(
        (value) => Boolean(value.text.trim()) || Boolean(value.videoUrl),
        {
          message: "Provide text or a video for AI capture",
          path: ["text"],
        }
      )
    )
    .output(journalAICaptureResultSchema)
    .mutation(async ({ ctx, input }) => {
      return parseNaturalJournalCapture(input.text, {
        userId: ctx.session.user.id,
        accountId: input.accountId,
        videoUrl: input.videoUrl,
        videoName: input.videoName,
        videoMimeType: input.videoMimeType,
      });
    }),

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
      linkedEdgeId: z.string().nullable().optional(),
      linkedMissedTradeId: z.string().nullable().optional(),
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
          linkedEdgeId: original.linkedEdgeId,
          linkedMissedTradeId: original.linkedMissedTradeId,
          entryType: original.entryType,
          tags: original.tags,
          journalDate: original.journalDate,
          wordCount: original.wordCount,
          readTimeMinutes: original.readTimeMinutes,
        })
        .returning();

      return duplicate;
    }),

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

      const typeBreakdown = await db
        .select({
          entryType: journalEntry.entryType,
          count: sql<number>`count(*)::int`,
        })
        .from(journalEntry)
        .where(and(...activeConditions))
        .groupBy(journalEntry.entryType);

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

      return db
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
    }),

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
      const newGoalIds = currentGoalIds.filter((id) => id !== input.goalId);

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
      return db
        .select({
          id: journalEntryGoal.id,
          goalId: journalEntryGoal.goalId,
          context: journalEntryGoal.context,
          contribution: journalEntryGoal.contribution,
          createdAt: journalEntryGoal.createdAt,
          goal: goal,
        })
        .from(journalEntryGoal)
        .innerJoin(journalEntry, eq(journalEntryGoal.entryId, journalEntry.id))
        .innerJoin(goal, eq(journalEntryGoal.goalId, goal.id))
        .where(and(
          eq(journalEntryGoal.entryId, input.entryId),
          eq(journalEntry.userId, ctx.session.user.id),
          eq(goal.userId, ctx.session.user.id)
        ));
    }),

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

      return results.map((result) => {
        let highlightedText = result.plainTextContent || '';
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
          ...result,
          highlightedText,
        };
      });
    }),
};
