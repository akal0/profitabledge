import { sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  journalEntry,
  type JournalBlock,
} from '../../db/schema/journal';
import { isAllAccountsScope, resolveScopedAccountIds } from '../../lib/account-scope';

export const psychologyEmotionalStateValues = [
  'calm',
  'confident',
  'neutral',
  'excited',
  'anxious',
  'stressed',
  'frustrated',
  'angry',
  'confused',
  'discouraged',
  'overwhelmed',
  'regretful',
  'impatient',
] as const;

export const psychologyEmotionalStateSchema = z.enum(
  psychologyEmotionalStateValues
);

export const psychologySchema = z.object({
  mood: z.number().min(1).max(10),
  confidence: z.number().min(1).max(10),
  energy: z.number().min(1).max(10),
  focus: z.number().min(1).max(10),
  fear: z.number().min(1).max(10),
  greed: z.number().min(1).max(10),
  emotionalState: psychologyEmotionalStateSchema,
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

export const journalEntryTypeSchema = z.enum(journalEntryTypeValues);

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
  trades: z.array(z.object({
    id: z.string(),
    symbol: z.string().nullable().optional(),
    tradeDirection: z.enum(['long', 'short']).optional(),
    profit: z.number().nullable().optional(),
    pips: z.number().nullable().optional(),
    close: z.string().nullable().optional(),
    outcome: z.string().nullable().optional(),
  })).optional(),
  symbol: z.string().optional(),
  tradeDirection: z.enum(['long', 'short']).optional(),
  profit: z.number().optional(),
  pips: z.number().optional(),
  closeTime: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
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

export const journalBlockSchema: z.ZodType<JournalBlock> = z.lazy(() =>
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

export function sqlStringList(values: string[]) {
  return sql.join(values.map((value) => sql`${value}`), sql`, `);
}

export async function getJournalAccountScopeCondition(
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

export function calculateWordCount(blocks: JournalBlock[]): number {
  let count = 0;

  function countBlock(block: JournalBlock) {
    if (block.content) {
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
