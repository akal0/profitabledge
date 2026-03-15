/**
 * Journal Prompts Service
 * 
 * Generates AI-powered journaling prompts based on:
 * - Trade close events
 * - Goal progress
 * - Detected patterns
 * - Scheduled reflections (daily/weekly)
 */

import { db } from "../db";
import { journalPromptQueue, journalEntry } from "../db/schema/journal";
import { trade, goal, tradingAccount } from "../db/schema/trading";
import { eq, and, gte, lte, desc, sql, isNull } from "drizzle-orm";
import { generateMeteredGeminiContent } from "./ai/gemini";
import { logAIProviderError } from "./ai/provider-errors";

const JOURNAL_PROMPTS_MODEL = "gemini-2.5-flash";

export type PromptType = 'trade_review' | 'daily_reflection' | 'pattern_inquiry' | 'goal_progress' | 'psychology_check';
export type TriggerType = 'trade_close' | 'streak' | 'goal_progress' | 'schedule' | 'pattern_detected';

export interface GeneratedPrompt {
  type: PromptType;
  title: string;
  questions: string[];
  tradeId?: string;
  goalId?: string;
}

export async function generateTradeClosePrompt(
  tradeId: string,
  userId: string
): Promise<GeneratedPrompt | null> {
  const [tradeData] = await db
    .select()
    .from(trade)
    .where(eq(trade.id, tradeId))
    .limit(1);

  if (!tradeData) return null;

  const isWin = Number(tradeData.profit || 0) > 0;
  const isLoss = Number(tradeData.profit || 0) < 0;
  const isBE = Math.abs(Number(tradeData.profit || 0)) < 1;

  const prompt = `Generate a journaling prompt for a trader who just closed a trade.

Trade Details:
- Symbol: ${tradeData.symbol}
- Type: ${tradeData.tradeType?.toUpperCase()}
- Outcome: ${isWin ? 'WIN' : isLoss ? 'LOSS' : 'BREAKEVEN'}
- Profit: $${tradeData.profit || 0}
- Pips: ${tradeData.pips || 0}
- R:R Achieved: ${tradeData.realisedRR || 'N/A'}
- Session: ${tradeData.sessionTag || 'Not specified'}
- Model/Strategy: ${tradeData.modelTag || 'Not specified'}

Generate 2-4 thoughtful questions for the trader to reflect on. Questions should:
${isWin ? `- Focus on what went right and how to replicate it
- Ask about execution quality and psychology during the trade
- Encourage gratitude without overconfidence` : 
  isLoss ? `- Focus on learning without judgment
- Ask about setup quality and execution
- Encourage reflection on risk management` :
  `- Focus on why the trade didn't work as planned
  - Ask about what could have been done differently`}

Respond in JSON format:
{
  "title": "string - catchy title for the prompt",
  "questions": ["string - question 1", "string - question 2", ...]
  }`;

  try {
    const result = await generateMeteredGeminiContent({
      userId,
      accountId: tradeData.accountId,
      featureKey: "journal.prompt.trade_close",
      model: JOURNAL_PROMPTS_MODEL,
      request: prompt,
      metadata: {
        tradeId,
      },
    });
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      type: 'trade_review',
      title: parsed.title,
      questions: parsed.questions,
      tradeId
    };
  } catch (error) {
    logAIProviderError("Journal trade-close prompt generation", error);
    
    return {
      type: 'trade_review',
      title: isWin ? 'Winner Reflection' : isLoss ? 'Learning Opportunity' : 'Breakeven Analysis',
      questions: isWin ? [
        'What did you do well in this trade?',
        'How was your execution compared to your plan?',
        'What can you learn from this success?'
      ] : isLoss ? [
        'What went wrong with this trade?',
        'Did you follow your trading plan?',
        'What will you do differently next time?'
      ] : [
        'Why did this trade end at breakeven?',
        'What could you have done to capture more profit?',
        'Did you manage the trade properly?'
      ],
      tradeId
    };
  }
}

export async function generateGoalProgressPrompt(
  goalId: string,
  progressPercent: number,
  userId: string
): Promise<GeneratedPrompt | null> {
  const [goalData] = await db
    .select()
    .from(goal)
    .where(eq(goal.id, goalId))
    .limit(1);

  if (!goalData) return null;

  const prompt = `Generate a journaling prompt for a trader working toward a goal.

Goal Details:
- Title: ${goalData.title}
- Type: ${goalData.type}
- Target: ${goalData.targetValue} ${goalData.targetType}
- Current Progress: ${progressPercent}%
- Status: ${goalData.status}

${progressPercent >= 75 ? 'The goal is close to being achieved!' : 
  progressPercent >= 50 ? 'Halfway to the goal!' :
  progressPercent >= 25 ? 'Making progress on the goal.' :
  'Just getting started on the goal.'}

Generate 2-3 questions that encourage reflection on:
- What's working toward this goal
- What challenges are being faced
- What adjustments might help

Respond in JSON format:
{
  "title": "string",
  "questions": ["string - question 1", "string - question 2", ...]
  }`;

  try {
    const result = await generateMeteredGeminiContent({
      userId,
      featureKey: "journal.prompt.goal_progress",
      model: JOURNAL_PROMPTS_MODEL,
      request: prompt,
      metadata: {
        goalId,
        progressPercent,
      },
    });
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      type: 'goal_progress',
      title: parsed.title,
      questions: parsed.questions,
      goalId
    };
  } catch (error) {
    logAIProviderError("Journal goal-progress prompt generation", error);
    
    return {
      type: 'goal_progress',
      title: `Goal Check-in: ${goalData.title}`,
      questions: [
        `You're at ${progressPercent}% of your goal. What's been working well?`,
        'What obstacles have you encountered?',
        'What one thing could you do differently to accelerate progress?'
      ],
      goalId
    };
  }
}

export async function generatePatternPrompt(
  pattern: { type: string; title: string; description: string },
  userId: string
): Promise<GeneratedPrompt> {
  const prompt = `Generate a journaling prompt for a trader based on a detected pattern.

Pattern:
- Type: ${pattern.type}
- Title: ${pattern.title}
- Description: ${pattern.description}

Generate 2-3 questions that help the trader:
- Understand this pattern better
- Decide how to address it
- Turn the insight into action

Respond in JSON format:
{
  "title": "string",
  "questions": ["string - question 1", "string - question 2", ...]
  }`;

  try {
    const result = await generateMeteredGeminiContent({
      userId,
      featureKey: "journal.prompt.pattern",
      model: JOURNAL_PROMPTS_MODEL,
      request: prompt,
      metadata: {
        patternType: pattern.type,
      },
    });
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultPatternPrompt(pattern);
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      type: 'pattern_inquiry',
      title: parsed.title,
      questions: parsed.questions
    };
  } catch {
    return getDefaultPatternPrompt(pattern);
  }
}

function getDefaultPatternPrompt(pattern: { type: string; title: string; description: string }): GeneratedPrompt {
  return {
    type: 'pattern_inquiry',
    title: `Pattern Detected: ${pattern.title}`,
    questions: [
      `I've noticed: ${pattern.description}. Does this resonate with your experience?`,
      'How has this pattern affected your trading recently?',
      'What small change could you make to address this pattern?'
    ]
  };
}

export async function generateDailyReflectionPrompt(
  userId: string
): Promise<GeneratedPrompt> {
  const prompt = `Generate a daily trading reflection prompt with 3-4 questions.

The questions should cover:
1. Overall trading performance today
2. Emotional/psychological state
3. Lessons learned
4. Intentions for tomorrow

Respond in JSON format:
{
  "title": "string - e.g., 'End of Day Reflection'",
  "questions": ["string - question 1", "string - question 2", ...]
  }`;

  try {
    const result = await generateMeteredGeminiContent({
      userId,
      featureKey: "journal.prompt.daily_reflection",
      model: JOURNAL_PROMPTS_MODEL,
      request: prompt,
    });
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultDailyPrompt();
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      type: 'daily_reflection',
      title: parsed.title,
      questions: parsed.questions
    };
  } catch {
    return getDefaultDailyPrompt();
  }
}

function getDefaultDailyPrompt(): GeneratedPrompt {
  return {
    type: 'daily_reflection',
    title: 'Daily Trading Reflection',
    questions: [
      'How did your trading go today? What went well?',
      'How would you rate your focus and discipline today (1-10)?',
      'What\'s one lesson you\'re taking away from today\'s session?',
      'What\'s your intention for tomorrow\'s trading?'
    ]
  };
}

export async function queuePrompt(
  userId: string,
  prompt: GeneratedPrompt,
  triggerType: TriggerType,
  triggerData?: Record<string, any>,
  priority: number = 0
): Promise<string> {
  const [queued] = await db
    .insert(journalPromptQueue)
    .values({
      userId,
      type: prompt.type,
      title: prompt.title,
      questions: prompt.questions,
      triggerType,
      triggerData,
      tradeId: prompt.tradeId,
      goalId: prompt.goalId,
      priority,
      status: 'pending'
    })
    .returning();

  return queued.id;
}

export async function getPendingPrompts(userId: string): Promise<typeof journalPromptQueue.$inferSelect[]> {
  return db
    .select()
    .from(journalPromptQueue)
    .where(and(
      eq(journalPromptQueue.userId, userId),
      eq(journalPromptQueue.status, 'pending'),
      sql`(${journalPromptQueue.expiresAt} IS NULL OR ${journalPromptQueue.expiresAt} > NOW())`
    ))
    .orderBy(desc(journalPromptQueue.priority), desc(journalPromptQueue.createdAt))
    .limit(10);
}

export async function markPromptShown(promptId: string): Promise<void> {
  await db
    .update(journalPromptQueue)
    .set({
      status: 'shown',
      shownAt: new Date()
    })
    .where(eq(journalPromptQueue.id, promptId));
}

export async function dismissPrompt(promptId: string): Promise<void> {
  await db
    .update(journalPromptQueue)
    .set({
      status: 'dismissed',
      dismissedAt: new Date()
    })
    .where(eq(journalPromptQueue.id, promptId));
}

export async function completePrompt(promptId: string, resultingEntryId: string): Promise<void> {
  await db
    .update(journalPromptQueue)
    .set({
      status: 'completed',
      completedAt: new Date(),
      resultingEntryId
    })
    .where(eq(journalPromptQueue.id, promptId));
}

export async function autoQueueTradeClosePrompts(userId: string): Promise<void> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const recentClosedTrades = await db
    .select({ trade: trade })
    .from(trade)
    .innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
    .leftJoin(journalPromptQueue, and(
      eq(journalPromptQueue.tradeId, trade.id),
      eq(journalPromptQueue.userId, userId),
      eq(journalPromptQueue.triggerType, 'trade_close')
    ))
    .where(and(
      eq(tradingAccount.userId, userId),
      gte(trade.closeTime, oneHourAgo),
      isNull(journalPromptQueue.id)
    ))

  for (const { trade: t } of recentClosedTrades) {
    if (!t.id) continue;

    const prompt = await generateTradeClosePrompt(t.id, userId);
    if (prompt) {
      await queuePrompt(userId, prompt, 'trade_close', {
        symbol: t.symbol,
        profit: t.profit,
        outcome: Number(t.profit || 0) > 0 ? 'win' : Number(t.profit || 0) < 0 ? 'loss' : 'breakeven'
      });
    }
  }
}

export async function autoQueueStreakPrompts(userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recentTrades = await db
    .select()
    .from(trade)
    .innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
    .where(and(
      eq(tradingAccount.userId, userId),
      gte(trade.closeTime, today)
    ))
    .orderBy(desc(trade.closeTime))
    .limit(10);

  if (recentTrades.length < 3) return;

  let streakCount = 0;
  let streakType: 'win' | 'loss' | null = null;

  for (const t of recentTrades) {
    const isWin = Number(t.trade.profit || 0) > 0;
    
    if (streakType === null) {
      streakType = isWin ? 'win' : 'loss';
      streakCount = 1;
    } else if (
      (streakType === 'win' && isWin) ||
      (streakType === 'loss' && !isWin)
    ) {
      streakCount++;
    } else {
      break;
    }
  }

  if (streakCount >= 3) {
    const existingPrompt = await db
      .select()
      .from(journalPromptQueue)
      .where(and(
        eq(journalPromptQueue.userId, userId),
        eq(journalPromptQueue.triggerType, 'streak'),
        gte(journalPromptQueue.createdAt, today)
      ))
      .limit(1);

    if (existingPrompt.length === 0) {
      const prompt: GeneratedPrompt = {
        type: 'psychology_check',
        title: streakType === 'win' ? `${streakCount} Trade Win Streak!` : `${streakCount} Trade Losing Streak`,
        questions: streakType === 'win' ? [
          'Congratulations on your winning streak! What\'s contributing to your success right now?',
          'Are you maintaining discipline, or getting overconfident?',
          'How can you keep this momentum going without forcing trades?'
        ] : [
          'You\'re in a losing streak. What\'s happening in your trading?',
          'Are you deviating from your strategy or just facing tough markets?',
          'What\'s your plan to get back on track? Consider taking a break if needed.'
        ]
      };

      await queuePrompt(userId, prompt, 'streak', {
        streakCount,
        streakType
      }, streakType === 'loss' ? 10 : 5);
    }
  }
}
