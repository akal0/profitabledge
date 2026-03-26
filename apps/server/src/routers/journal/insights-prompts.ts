import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../db';
import { journalEntry, type JournalBlock } from '../../db/schema/journal';
import { trade as tradeTable } from '../../db/schema/trading';
import {
  extractPatternsFromEntries,
  generateJournalContextQuery,
  generateJournalSummary,
} from '../../lib/journal-ai-analysis';
import {
  autoQueueStreakPrompts,
  autoQueueTradeClosePrompts,
  completePrompt,
  dismissPrompt,
  generateDailyReflectionPrompt,
  generateTradeClosePrompt,
  getPendingPrompts,
  markPromptShown,
  queuePrompt,
} from '../../lib/journal-prompts';
import {
  calculatePsychologyCorrelations,
  getBestTradingConditions,
  getCachedCorrelations,
} from '../../lib/psychology-correlation';
import { protectedProcedure } from '../../lib/trpc';
import { calculateWordCount, getJournalAccountScopeCondition } from './shared';

export const journalInsightPromptProcedures = {
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
      accountId: z.string().optional(),
      limit: z.number().min(3).max(20).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const { condition: accountScopeCondition, isEmpty } =
        await getJournalAccountScopeCondition(ctx.session.user.id, input.accountId);

      if (isEmpty) {
        return [];
      }

      const scopedEntries = await db
        .select({ id: journalEntry.id })
        .from(journalEntry)
        .where(
          and(
            eq(journalEntry.userId, ctx.session.user.id),
            input.entryIds?.length ? inArray(journalEntry.id, input.entryIds) : undefined,
            accountScopeCondition ?? undefined
          )
        )
        .orderBy(desc(journalEntry.updatedAt))
        .limit(input.limit);

      const entryIds = scopedEntries.map((entry) => entry.id);

      if (entryIds.length < 3) {
        throw new Error('Need at least 3 entries to analyze patterns');
      }

      return extractPatternsFromEntries(ctx.session.user.id, entryIds);
    }),

  askJournal: protectedProcedure
    .input(z.object({
      question: z.string().min(5),
      accountId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return generateJournalContextQuery(input.question, ctx.session.user.id, {
        accountId: input.accountId,
      });
    }),

  getPsychologyCorrelations: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
      forceRecalculate: z.boolean().optional(),
      periodDays: z.number().min(7).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      if (input.forceRecalculate) {
        return calculatePsychologyCorrelations(
          ctx.session.user.id,
          input.accountId,
          input.periodDays
        );
      }

      const cached = await getCachedCorrelations(ctx.session.user.id, input.accountId);

      if (cached.length === 0) {
        return calculatePsychologyCorrelations(
          ctx.session.user.id,
          input.accountId,
          input.periodDays
        );
      }

      return cached;
    }),

  getOptimalTradingConditions: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return getBestTradingConditions(ctx.session.user.id, input.accountId);
    }),

  getPrompts: protectedProcedure.query(async ({ ctx }) => {
    return getPendingPrompts(ctx.session.user.id);
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
      const prompt = await generateTradeClosePrompt(
        input.tradeId,
        ctx.session.user.id
      );

      if (!prompt) {
        throw new Error('Failed to generate prompt');
      }

      const promptId = await queuePrompt(ctx.session.user.id, prompt, 'trade_close', {
        tradeId: input.tradeId,
      });

      return { id: promptId, ...prompt };
    }),

  generateDailyPrompt: protectedProcedure
    .mutation(async ({ ctx }) => {
      const prompt = await generateDailyReflectionPrompt(ctx.session.user.id);

      const promptId = await queuePrompt(ctx.session.user.id, prompt, 'schedule', {
        type: 'daily',
      });

      return { id: promptId, ...prompt };
    }),

  autoGeneratePrompts: protectedProcedure
    .mutation(async ({ ctx }) => {
      await autoQueueTradeClosePrompts(ctx.session.user.id);
      await autoQueueStreakPrompts(ctx.session.user.id);
      return getPendingPrompts(ctx.session.user.id);
    }),

  autoGenerateEntry: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        date: z.string().optional(),
        tradeIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const targetDate = input.date ? new Date(input.date) : new Date();
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const trades = input.tradeIds?.length
        ? await db
            .select()
            .from(tradeTable)
            .where(
              and(
                eq(tradeTable.accountId, input.accountId),
                inArray(tradeTable.id, input.tradeIds)
              )
            )
        : await db
            .select()
            .from(tradeTable)
            .where(
              and(
                eq(tradeTable.accountId, input.accountId),
                gte(tradeTable.openTime, dayStart),
                lte(tradeTable.openTime, dayEnd)
              )
            );

      if (trades.length === 0) {
        throw new Error('No trades found for this period');
      }

      const totalPnl = trades.reduce((sum, trade) => sum + parseFloat(trade.profit?.toString() || '0'), 0);
      const winners = trades.filter((trade) => parseFloat(trade.profit?.toString() || '0') > 0);
      const losers = trades.filter((trade) => parseFloat(trade.profit?.toString() || '0') < 0);
      const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
      const bestTrade = trades.reduce((best, trade) => {
        const pnl = parseFloat(trade.profit?.toString() || '0');
        return pnl > parseFloat(best.profit?.toString() || '0') ? trade : best;
      }, trades[0]);
      const worstTrade = trades.reduce((worst, trade) => {
        const pnl = parseFloat(trade.profit?.toString() || '0');
        return pnl < parseFloat(worst.profit?.toString() || '0') ? trade : worst;
      }, trades[0]);

      const dateStr = targetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const blocks: JournalBlock[] = [
        {
          id: crypto.randomUUID(),
          type: 'heading2',
          content: `Trading Session - ${dateStr}`,
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: `<strong>${trades.length}</strong> trades | <strong>${winRate.toFixed(0)}%</strong> win rate | Net P&L: <strong style="color: ${totalPnl >= 0 ? '#22c55e' : '#ef4444'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</strong>`,
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: 'heading3',
          content: 'Trade Summary',
          children: [],
        },
      ];

      for (const trade of trades) {
        const pnl = parseFloat(trade.profit?.toString() || '0');
        const rr = parseFloat(trade.realisedRR?.toString() || '0');
        blocks.push({
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: `<strong>${trade.symbol}</strong> ${trade.tradeType?.toUpperCase()} — ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${rr >= 0 ? '+' : ''}${rr.toFixed(2)}R) | ${trade.sessionTag || 'No session'} | ${trade.modelTag || 'No model'}`,
          children: [],
        });
      }

      blocks.push(
        {
          id: crypto.randomUUID(),
          type: 'heading3',
          content: 'Key Observations',
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: 'callout',
          props: { calloutEmoji: '✅', calloutType: 'success' },
          content: `Best trade: ${bestTrade.symbol} ${bestTrade.tradeType?.toUpperCase()} (+$${parseFloat(bestTrade.profit?.toString() || '0').toFixed(2)})`,
          children: [],
        },
      );

      if (losers.length > 0) {
        blocks.push({
          id: crypto.randomUUID(),
          type: 'callout',
          props: { calloutEmoji: '⚠️', calloutType: 'warning' },
          content: `Worst trade: ${worstTrade.symbol} ${worstTrade.tradeType?.toUpperCase()} ($${parseFloat(worstTrade.profit?.toString() || '0').toFixed(2)})`,
          children: [],
        });
      }

      blocks.push(
        {
          id: crypto.randomUUID(),
          type: 'heading3',
          content: 'Reflection',
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: 'bulletList',
          content: 'What went well today?',
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: 'bulletList',
          content: 'What could I have done better?',
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: 'bulletList',
          content: 'Did I follow my trading rules?',
          children: [],
        },
        {
          id: crypto.randomUUID(),
          type: 'bulletList',
          content: 'What will I focus on tomorrow?',
          children: [],
        },
      );

      const title = `${totalPnl >= 0 ? '📈' : '📉'} ${dateStr} — ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`;
      const plainText = blocks.map((block) => (block.content || '').replace(/<[^>]*>/g, '')).join(' ');
      const wordCount = calculateWordCount(blocks);

      const [entry] = await db
        .insert(journalEntry)
        .values({
          userId,
          title,
          emoji: totalPnl >= 0 ? '📈' : '📉',
          content: blocks,
          accountIds: [input.accountId],
          linkedTradeIds: trades.map((trade) => trade.id),
          entryType: 'daily',
          tags: ['auto-generated', 'daily-review'],
          plainTextContent: plainText,
          journalDate: targetDate,
          wordCount,
          readTimeMinutes: Math.ceil(wordCount / 200),
          tradePhase: 'post-trade',
        })
        .returning();

      return entry;
    }),

  generatePeriodReview: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        period: z.enum(['week', 'month']),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const end = input.endDate ? new Date(input.endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      if (input.period === 'week') {
        start.setDate(start.getDate() - 7);
      } else {
        start.setMonth(start.getMonth() - 1);
      }
      start.setHours(0, 0, 0, 0);

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
        throw new Error('No trades found for this period');
      }

      const pnls = trades.map((trade) => parseFloat(trade.profit?.toString() || '0'));
      const totalPnl = pnls.reduce((sum, pnl) => sum + pnl, 0);
      const wins = pnls.filter((pnl) => pnl > 0);
      const losses = pnls.filter((pnl) => pnl < 0);
      const winRate = (wins.length / trades.length) * 100;
      const grossWin = wins.reduce((sum, pnl) => sum + pnl, 0);
      const grossLoss = Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0));
      const profitFactor = grossLoss > 0 ? grossWin / grossLoss : 0;
      const realisedRrs = trades
        .map((trade) => parseFloat(trade.realisedRR?.toString() || '0'))
        .filter((rr) => rr !== 0);
      const avgRR = realisedRrs.length > 0
        ? realisedRrs.reduce((sum, rr) => sum + rr, 0) / realisedRrs.length
        : 0;

      const dailyPnls: Record<string, number> = {};
      for (const trade of trades) {
        if (!trade.openTime) continue;
        const day = new Date(trade.openTime).toISOString().split('T')[0];
        dailyPnls[day] = (dailyPnls[day] || 0) + parseFloat(trade.profit?.toString() || '0');
      }
      const greenDays = Object.values(dailyPnls).filter((pnl) => pnl > 0).length;
      const totalDays = Object.keys(dailyPnls).length;

      const symbolStats: Record<string, { count: number; pnl: number }> = {};
      for (const trade of trades) {
        const symbol = trade.symbol || 'unknown';
        if (!symbolStats[symbol]) symbolStats[symbol] = { count: 0, pnl: 0 };
        symbolStats[symbol].count += 1;
        symbolStats[symbol].pnl += parseFloat(trade.profit?.toString() || '0');
      }
      const topSymbol = Object.entries(symbolStats).sort((a, b) => b[1].pnl - a[1].pnl)[0];
      const worstSymbol = Object.entries(symbolStats).sort((a, b) => a[1].pnl - b[1].pnl)[0];

      const periodLabel = input.period === 'week' ? 'Weekly' : 'Monthly';
      const dateRange = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      const blocks: JournalBlock[] = [
        { id: crypto.randomUUID(), type: 'heading2', content: `${periodLabel} Review: ${dateRange}`, children: [] },
        { id: crypto.randomUUID(), type: 'paragraph', content: `<strong>${trades.length}</strong> trades over <strong>${totalDays}</strong> trading days`, children: [] },
        { id: crypto.randomUUID(), type: 'heading3', content: 'Performance Scorecard', children: [] },
        { id: crypto.randomUUID(), type: 'paragraph', content: `<strong>Net P&L:</strong> <span style="color:${totalPnl >= 0 ? '#22c55e' : '#ef4444'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</span>`, children: [] },
        { id: crypto.randomUUID(), type: 'paragraph', content: `<strong>Win Rate:</strong> ${winRate.toFixed(1)}% (${wins.length}W / ${losses.length}L)`, children: [] },
        { id: crypto.randomUUID(), type: 'paragraph', content: `<strong>Profit Factor:</strong> ${profitFactor.toFixed(2)} | <strong>Avg R:R:</strong> ${avgRR.toFixed(2)}`, children: [] },
        { id: crypto.randomUUID(), type: 'paragraph', content: `<strong>Green Days:</strong> ${greenDays}/${totalDays} (${totalDays > 0 ? ((greenDays / totalDays) * 100).toFixed(0) : 0}%)`, children: [] },
        { id: crypto.randomUUID(), type: 'heading3', content: 'Symbol Breakdown', children: [] },
      ];

      if (topSymbol) {
        blocks.push({
          id: crypto.randomUUID(),
          type: 'callout',
          props: { calloutEmoji: '🏆', calloutType: 'success' },
          content: `Best: ${topSymbol[0]} — +$${topSymbol[1].pnl.toFixed(2)} (${topSymbol[1].count} trades)`,
          children: [],
        });
      }
      if (worstSymbol && worstSymbol[1].pnl < 0) {
        blocks.push({
          id: crypto.randomUUID(),
          type: 'callout',
          props: { calloutEmoji: '⚠️', calloutType: 'warning' },
          content: `Worst: ${worstSymbol[0]} — $${worstSymbol[1].pnl.toFixed(2)} (${worstSymbol[1].count} trades)`,
          children: [],
        });
      }

      blocks.push(
        { id: crypto.randomUUID(), type: 'heading3', content: 'Reflection', children: [] },
        { id: crypto.randomUUID(), type: 'bulletList', content: `What was my biggest win this ${input.period}?`, children: [] },
        { id: crypto.randomUUID(), type: 'bulletList', content: 'What patterns did I notice in my losing trades?', children: [] },
        { id: crypto.randomUUID(), type: 'bulletList', content: 'Did I stick to my rules and edge conditions?', children: [] },
        { id: crypto.randomUUID(), type: 'bulletList', content: `What is my #1 focus for next ${input.period}?`, children: [] },
        { id: crypto.randomUUID(), type: 'bulletList', content: 'Rate my discipline this period: /10', children: [] },
        { id: crypto.randomUUID(), type: 'heading3', content: `Goals for Next ${periodLabel.replace('ly', '')}`, children: [] },
        { id: crypto.randomUUID(), type: 'numberedList', content: ' ', children: [] },
        { id: crypto.randomUUID(), type: 'numberedList', content: ' ', children: [] },
        { id: crypto.randomUUID(), type: 'numberedList', content: ' ', children: [] },
      );

      const title = `${totalPnl >= 0 ? '📈' : '📉'} ${periodLabel} Review: ${dateRange} — ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`;
      const plainText = blocks.map((block) => (block.content || '').replace(/<[^>]*>/g, '')).join(' ');
      const wordCount = calculateWordCount(blocks);

      const [entry] = await db
        .insert(journalEntry)
        .values({
          userId,
          title,
          emoji: totalPnl >= 0 ? '📈' : '📉',
          content: blocks,
          accountIds: [input.accountId],
          linkedTradeIds: trades.map((trade) => trade.id),
          entryType: input.period === 'week' ? 'weekly' : 'monthly',
          tags: ['auto-generated', `${input.period}ly-review`],
          plainTextContent: plainText,
          journalDate: end,
          wordCount,
          readTimeMinutes: Math.ceil(wordCount / 200),
          tradePhase: 'post-trade',
        })
        .returning();

      return entry;
    }),
};
