import { z } from "zod";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { goal as goalTable, trade, tradingAccount } from "../db/schema/trading";
import { journalEntry } from "../db/schema/journal";
import { tradeChecklistResult } from "../db/schema/coaching";
import { eq, and, desc, gte, lte, asc, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { evaluateCustomGoal, checkGoalAchieved } from "../lib/goal-evaluation";
import { createNotification } from "../lib/notifications";
import type { CustomGoalCriteria } from "../types/custom-goals";

// Goal type schemas
const goalTypeEnum = z.enum(["daily", "weekly", "monthly", "milestone"]);
const targetTypeEnum = z.enum([
  "profit",
  "winRate",
  "consistency",
  "rr",
  "trades",
  "streak",
  // Process goals (P0 improvement — behavior-based, not outcome-based)
  "journalRate",        // % of trades journaled
  "ruleCompliance",     // % of trades following rules
  "edgeTradeRate",      // % of trades taken during edge conditions
  "maxRiskPerTrade",    // kept risk per trade under target %
  "breakAfterLoss",     // took a break after a loss (min X minutes gap)
  "checklistCompletion", // completed pre-trade checklist
]);
const statusEnum = z.enum(["active", "achieved", "failed", "paused"]);
const PROCESS_TARGET_TYPES = [
  "journalRate",
  "ruleCompliance",
  "edgeTradeRate",
  "maxRiskPerTrade",
  "breakAfterLoss",
  "checklistCompletion",
] as const;
const GOAL_PROGRESS_MILESTONES = [25, 50, 75, 90] as const;

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatGoalValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 100 || Number.isInteger(value)) {
    return value.toFixed(0);
  }
  if (Math.abs(value) >= 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return value.toFixed(2).replace(/\.00$/, "");
}

function getGoalProgressMilestone(
  previousValue: number,
  currentValue: number,
  targetValue: number
): number | null {
  if (!(targetValue > 0)) return null;

  const previousPercent = (previousValue / targetValue) * 100;
  const currentPercent = (currentValue / targetValue) * 100;

  if (currentPercent >= 100) {
    return null;
  }

  let milestone: number | null = null;
  for (const candidate of GOAL_PROGRESS_MILESTONES) {
    if (previousPercent < candidate && currentPercent >= candidate) {
      milestone = candidate;
    }
  }

  return milestone;
}

async function notifyGoalProgressChange(input: {
  userId: string;
  goalId: string;
  accountId?: string | null;
  goalTitle: string;
  targetType: string;
  previousValue: number;
  currentValue: number;
  targetValue: number;
  achieved: boolean;
}) {
  const metadata = {
    goalId: input.goalId,
    targetType: input.targetType,
    currentValue: input.currentValue,
    targetValue: input.targetValue,
    url: "/dashboard/goals",
  };

  try {
    if (input.achieved) {
      await createNotification({
        userId: input.userId,
        accountId: input.accountId ?? null,
        type: "goal_achieved",
        title: `Goal achieved: ${input.goalTitle}`,
        body: `Reached ${formatGoalValue(input.currentValue)} / ${formatGoalValue(
          input.targetValue
        )}.`,
        metadata,
        dedupeKey: `goal-achieved:${input.goalId}`,
      });
      return;
    }

    const milestone = getGoalProgressMilestone(
      input.previousValue,
      input.currentValue,
      input.targetValue
    );

    if (!milestone) {
      return;
    }

    await createNotification({
      userId: input.userId,
      accountId: input.accountId ?? null,
      type: "goal_progress",
      title: `${input.goalTitle} is ${milestone}% complete`,
      body: `Progress is ${formatGoalValue(input.currentValue)} / ${formatGoalValue(
        input.targetValue
      )}.`,
      metadata: {
        ...metadata,
        milestone,
      },
      dedupeKey: `goal-progress:${input.goalId}:${milestone}`,
    });
  } catch (error) {
    console.error("[Goals] Notification failed:", error);
  }
}

async function resolveScopedAccountIds(userId: string, accountId?: string) {
  if (accountId) {
    const account = await db
      .select({ id: tradingAccount.id })
      .from(tradingAccount)
      .where(
        and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId))
      )
      .limit(1);

    return account.length > 0 ? [accountId] : [];
  }

  const accounts = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(eq(tradingAccount.userId, userId));

  return accounts.map((row) => row.id);
}

async function loadProcessSnapshot(userId: string, accountId?: string) {
  const accountIds = await resolveScopedAccountIds(userId, accountId);

  if (accountIds.length === 0) {
    return {
      accountIds,
      recentTrades: [] as Array<{
        id: string;
        accountId: string;
        profit: number;
        closeTime: Date | null;
        openTime: Date | null;
        protocolAlignment: string | null;
        sessionTag: string | null;
        modelTag: string | null;
      }>,
      journalEntries: [] as Array<{ linkedTradeIds: string[] | null }>,
      checklistRows: [] as Array<{ tradeId: string | null; completionRate: string | null }>,
    };
  }

  const [recentTrades, journalEntries, checklistRows] = await Promise.all([
    db
      .select({
        id: trade.id,
        accountId: trade.accountId,
        profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
        closeTime: trade.closeTime,
        openTime: trade.openTime,
        protocolAlignment: trade.protocolAlignment,
        sessionTag: trade.sessionTag,
        modelTag: trade.modelTag,
      })
      .from(trade)
      .where(inArray(trade.accountId, accountIds))
      .orderBy(desc(trade.closeTime))
      .limit(500),
    db
      .select({
        linkedTradeIds: journalEntry.linkedTradeIds,
      })
      .from(journalEntry)
      .where(
        and(eq(journalEntry.userId, userId), eq(journalEntry.isArchived, false))
      )
      .orderBy(desc(journalEntry.updatedAt))
      .limit(250),
    db
      .select({
        tradeId: tradeChecklistResult.tradeId,
        completionRate: tradeChecklistResult.completionRate,
      })
      .from(tradeChecklistResult)
      .where(
        and(
          eq(tradeChecklistResult.userId, userId),
          inArray(tradeChecklistResult.accountId, accountIds)
        )
      )
      .orderBy(desc(tradeChecklistResult.createdAt))
      .limit(500),
  ]);

  return { accountIds, recentTrades, journalEntries, checklistRows };
}

function filterSnapshotByAccount(
  snapshot: Awaited<ReturnType<typeof loadProcessSnapshot>>,
  accountId?: string | null
) {
  if (!accountId) return snapshot;

  return {
    ...snapshot,
    recentTrades: snapshot.recentTrades.filter(
      (tradeRow) => tradeRow.accountId === accountId
    ),
    checklistRows: snapshot.checklistRows.filter(
      (row) => snapshot.recentTrades.some((tradeRow) => tradeRow.id === row.tradeId && tradeRow.accountId === accountId)
    ),
  };
}

function computeProcessMetrics(snapshot: Awaited<ReturnType<typeof loadProcessSnapshot>>) {
  const { recentTrades, journalEntries, checklistRows } = snapshot;
  const totalTrades = recentTrades.length;
  const recentTradeIds = new Set(recentTrades.map((tradeRow) => tradeRow.id));

  const alignedTrades = recentTrades.filter(
    (tradeRow) => tradeRow.protocolAlignment === "aligned"
  ).length;
  const taggedTrades = recentTrades.filter(
    (tradeRow) => Boolean(tradeRow.sessionTag || tradeRow.modelTag)
  ).length;

  const reviewedTradeIds = new Set<string>();
  for (const entry of journalEntries) {
    for (const tradeId of entry.linkedTradeIds || []) {
      if (recentTradeIds.has(tradeId)) {
        reviewedTradeIds.add(tradeId);
      }
    }
  }

  const checklistRates = checklistRows
    .filter((row) => row.tradeId && recentTradeIds.has(row.tradeId))
    .map((row) => toNumber(row.completionRate));

  const sortedTrades = [...recentTrades].sort((a, b) => {
    const at = a.closeTime?.getTime() ?? 0;
    const bt = b.closeTime?.getTime() ?? 0;
    return at - bt;
  });

  let lossCount = 0;
  let properBreaks = 0;
  for (let i = 0; i < sortedTrades.length - 1; i++) {
    if (toNumber(sortedTrades[i].profit) < 0) {
      lossCount++;
      const nextOpenTime = sortedTrades[i + 1].openTime?.getTime() ?? 0;
      const thisCloseTime = sortedTrades[i].closeTime?.getTime() ?? 0;
      const gapMinutes = (nextOpenTime - thisCloseTime) / 60000;
      if (gapMinutes >= 15) {
        properBreaks++;
      }
    }
  }

  return {
    totalTrades,
    journalRate: totalTrades > 0 ? (reviewedTradeIds.size / totalTrades) * 100 : 0,
    ruleCompliance: totalTrades > 0 ? (alignedTrades / totalTrades) * 100 : 0,
    edgeTradeRate: totalTrades > 0 ? (taggedTrades / totalTrades) * 100 : 0,
    breakAfterLoss: lossCount > 0 ? (properBreaks / lossCount) * 100 : 100,
    checklistCompletion:
      checklistRates.length > 0
        ? checklistRates.reduce((sum, rate) => sum + rate, 0) / checklistRates.length
        : 0,
    lossesTracked: lossCount,
    checklistSamples: checklistRates.length,
  };
}

export const goalsRouter = router({
  // List all goals for a user
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
        status: statusEnum.optional(),
        type: goalTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const conditions = [eq(goalTable.userId, userId)];

      if (input.accountId) {
        conditions.push(eq(goalTable.accountId, input.accountId));
      }

      if (input.status) {
        conditions.push(eq(goalTable.status, input.status));
      }

      if (input.type) {
        conditions.push(eq(goalTable.type, input.type));
      }

      const goals = await db
        .select()
        .from(goalTable)
        .where(and(...conditions))
        .orderBy(desc(goalTable.createdAt));

      return goals;
    }),

  // Get a single goal by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const goals = await db
        .select()
        .from(goalTable)
        .where(and(eq(goalTable.id, input.id), eq(goalTable.userId, userId)))
        .limit(1);

      return goals[0] || null;
    }),

  // Create a new goal
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.string().optional().nullable(),
        type: goalTypeEnum,
        targetType: targetTypeEnum,
        targetValue: z.number(),
        startDate: z.string(), // ISO date string
        deadline: z.string().optional().nullable(), // ISO date string
        title: z.string(),
        description: z.string().optional(),
        isCustom: z.boolean().optional(),
        customCriteria: z.any().optional(), // CustomGoalCriteria type
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const id = nanoid();

      await db.insert(goalTable).values({
        id,
        userId,
        accountId: input.accountId || null,
        type: input.type,
        targetType: input.targetType,
        targetValue: input.targetValue.toString(),
        currentValue: "0",
        startDate: input.startDate,
        deadline: input.deadline || null,
        title: input.title,
        description: input.description || null,
        status: "active",
        achievements: [],
        progressHistory: [],
        isCustom: input.isCustom || false,
        customCriteria: input.customCriteria || null,
      });

      return { id, ok: true };
    }),

  // Update a goal
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        targetValue: z.number().optional(),
        status: statusEnum.optional(),
        deadline: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existingGoal = await db
        .select()
        .from(goalTable)
        .where(and(eq(goalTable.id, input.id), eq(goalTable.userId, userId)))
        .limit(1);

      const goal = existingGoal[0];
      if (!goal) {
        throw new Error("Goal not found");
      }

      const updateData: any = {};

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.targetValue !== undefined)
        updateData.targetValue = input.targetValue.toString();
      if (input.status !== undefined) updateData.status = input.status;
      if (input.deadline !== undefined) updateData.deadline = input.deadline;

      updateData.updatedAt = new Date();

      if (input.status === "achieved" || input.status === "failed") {
        updateData.completedAt = new Date();
      }

      await db
        .update(goalTable)
        .set(updateData)
        .where(and(eq(goalTable.id, input.id), eq(goalTable.userId, userId)));

      if (input.status === "achieved" && goal.status !== "achieved") {
        await notifyGoalProgressChange({
          userId,
          goalId: goal.id,
          accountId: goal.accountId,
          goalTitle: goal.title,
          targetType: goal.targetType,
          previousValue: toNumber(goal.currentValue),
          currentValue: toNumber(goal.targetValue),
          targetValue: toNumber(goal.targetValue),
          achieved: true,
        });
      }

      return { ok: true };
    }),

  // Update progress for a goal
  updateProgress: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        currentValue: z.number(),
        addToHistory: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get current goal
      const goals = await db
        .select()
        .from(goalTable)
        .where(and(eq(goalTable.id, input.id), eq(goalTable.userId, userId)))
        .limit(1);

      const goal = goals[0];
      if (!goal) {
        throw new Error("Goal not found");
      }
      const previousValue = toNumber(goal.currentValue);

      const updateData: any = {
        currentValue: input.currentValue.toString(),
        updatedAt: new Date(),
      };

      // Add to progress history if requested
      if (input.addToHistory) {
        const history = (goal.progressHistory as any[]) || [];
        history.push({
          timestamp: new Date().toISOString(),
          value: input.currentValue,
        });
        updateData.progressHistory = history;
      }

      // Check if goal is achieved
      const targetValue = parseFloat(goal.targetValue);
      if (input.currentValue >= targetValue && goal.status === "active") {
        updateData.status = "achieved";
        updateData.completedAt = new Date();

        // Add achievement
        const achievements = (goal.achievements as any[]) || [];
        achievements.push({
          type: "goal_completed",
          timestamp: new Date().toISOString(),
          value: input.currentValue,
        });
        updateData.achievements = achievements;
      }

      await db
        .update(goalTable)
        .set(updateData)
        .where(and(eq(goalTable.id, input.id), eq(goalTable.userId, userId)));

      await notifyGoalProgressChange({
        userId,
        goalId: goal.id,
        accountId: goal.accountId,
        goalTitle: goal.title,
        targetType: goal.targetType,
        previousValue,
        currentValue: input.currentValue,
        targetValue,
        achieved: updateData.status === "achieved",
      });

      return { ok: true };
    }),

  // Delete a goal
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .delete(goalTable)
        .where(and(eq(goalTable.id, input.id), eq(goalTable.userId, userId)));

      return { ok: true };
    }),

  // Get goal statistics
  getStats: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const conditions = [eq(goalTable.userId, userId)];

      if (input.accountId) {
        conditions.push(eq(goalTable.accountId, input.accountId));
      }

      const goals = await db
        .select()
        .from(goalTable)
        .where(and(...conditions));

      const stats = {
        total: goals.length,
        active: goals.filter((g) => g.status === "active").length,
        achieved: goals.filter((g) => g.status === "achieved").length,
        failed: goals.filter((g) => g.status === "failed").length,
        achievementRate:
          goals.length > 0
            ? (goals.filter((g) => g.status === "achieved").length /
                goals.length) *
              100
            : 0,
      };

      return stats;
    }),

  getProcessScorecard: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const snapshot = await loadProcessSnapshot(userId, input.accountId);
      const metrics = computeProcessMetrics(snapshot);

      return {
        ...metrics,
        hasTrades: metrics.totalTrades > 0,
        scope: input.accountId ? "account" : "all",
        recommendedGoals: [
          {
            targetType: "journalRate",
            title: "Journal 80% of closed trades",
            description: "Link reviews to most trades so lessons become searchable and coachable.",
            targetValue: 80,
          },
          {
            targetType: "ruleCompliance",
            title: "Keep rule compliance above 90%",
            description: "Raise the share of trades marked as aligned with your protocol.",
            targetValue: 90,
          },
          {
            targetType: "edgeTradeRate",
            title: "Take 85% of trades with a tagged setup",
            description: "Avoid random execution by tagging session or model before entry.",
            targetValue: 85,
          },
          {
            targetType: "breakAfterLoss",
            title: "Respect the post-loss pause 80% of the time",
            description: "Use a 15-minute reset after losses to reduce revenge entries.",
            targetValue: 80,
          },
          {
            targetType: "checklistCompletion",
            title: "Finish 90% of your trade checklist",
            description: "Use checklists as a pre-entry gate instead of an afterthought.",
            targetValue: 90,
          },
        ],
      };
    }),

  // Get active streaks
  getStreaks: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get user's account IDs
      let accountIds: string[] = [];
      if (input.accountId) {
        // Verify the account belongs to the user
        const account = await db
          .select({ id: tradingAccount.id })
          .from(tradingAccount)
          .where(and(eq(tradingAccount.id, input.accountId), eq(tradingAccount.userId, userId)))
          .limit(1);
        if (account.length > 0) {
          accountIds = [input.accountId];
        }
      } else {
        // Get all user's accounts
        const accounts = await db
          .select({ id: tradingAccount.id })
          .from(tradingAccount)
          .where(eq(tradingAccount.userId, userId));
        accountIds = accounts.map((a) => a.id);
      }

      if (accountIds.length === 0) {
        return {
          currentWinStreak: 0,
          longestWinStreak: 0,
          currentGreenDays: 0,
          longestGreenDays: 0,
        };
      }

      // Get all trades ordered by closeTime descending (newest first)
      const trades = await db
        .select({
          outcome: trade.outcome,
          profit: trade.profit,
          closeTime: trade.closeTime,
        })
        .from(trade)
        .where(
          and(
            inArray(trade.accountId, accountIds),
            sql`${trade.outcome} IS NOT NULL`,
            sql`${trade.closeTime} IS NOT NULL`
          )
        )
        .orderBy(desc(trade.closeTime));

      // Calculate win streaks
      let currentWinStreak = 0;
      let longestWinStreak = 0;
      let tempStreak = 0;
      let foundFirstNonWin = false;

      for (const t of trades) {
        const isWin = t.outcome === "Win" || t.outcome === "PW";
        
        if (isWin) {
          tempStreak++;
          if (!foundFirstNonWin) {
            currentWinStreak++;
          }
        } else {
          foundFirstNonWin = true;
          longestWinStreak = Math.max(longestWinStreak, tempStreak);
          tempStreak = 0;
        }
      }
      longestWinStreak = Math.max(longestWinStreak, tempStreak);

      // Calculate green days (days with positive total P&L)
      // Group trades by date
      const profitByDay = new Map<string, number>();
      for (const t of trades) {
        if (t.closeTime && t.profit) {
          const dateKey = t.closeTime.toISOString().split("T")[0];
          const currentProfit = profitByDay.get(dateKey) || 0;
          profitByDay.set(dateKey, currentProfit + parseFloat(t.profit));
        }
      }

      // Sort days newest to oldest
      const sortedDays = Array.from(profitByDay.entries())
        .sort((a, b) => b[0].localeCompare(a[0]));

      let currentGreenDays = 0;
      let longestGreenDays = 0;
      let tempGreenStreak = 0;
      let foundFirstRedDay = false;

      for (const [, profit] of sortedDays) {
        const isGreen = profit > 0;
        
        if (isGreen) {
          tempGreenStreak++;
          if (!foundFirstRedDay) {
            currentGreenDays++;
          }
        } else {
          foundFirstRedDay = true;
          longestGreenDays = Math.max(longestGreenDays, tempGreenStreak);
          tempGreenStreak = 0;
        }
      }
      longestGreenDays = Math.max(longestGreenDays, tempGreenStreak);

      return {
        currentWinStreak,
        longestWinStreak,
        currentGreenDays,
        longestGreenDays,
      };
    }),

  // Calculate/refresh custom goal progress
  refreshCustomGoalProgress: protectedProcedure
    .input(z.object({ goalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get the goal
      const goals = await db
        .select()
        .from(goalTable)
        .where(and(eq(goalTable.id, input.goalId), eq(goalTable.userId, userId)))
        .limit(1);

      const goal = goals[0];
      if (!goal) {
        throw new Error("Goal not found");
      }

      if (!goal.isCustom || !goal.customCriteria || !goal.accountId) {
        throw new Error("Goal is not a custom goal or missing required data");
      }

      const criteria = goal.customCriteria as CustomGoalCriteria;

      // Calculate end date based on goal type
      let endDate: string | undefined;
      if (goal.deadline) {
        endDate = goal.deadline;
      }

      // Evaluate the custom goal
      const currentValue = await evaluateCustomGoal(
        goal.accountId,
        criteria,
        goal.startDate,
        endDate
      );

      // Check if goal is achieved
      const isAchieved = checkGoalAchieved(currentValue, criteria);
      const previousValue = toNumber(goal.currentValue);

      // Update the goal
      const updateData: any = {
        currentValue: currentValue.toString(),
        updatedAt: new Date(),
      };

      if (isAchieved && goal.status === "active") {
        updateData.status = "achieved";
        updateData.completedAt = new Date();

        // Add achievement
        const achievements = (goal.achievements as any[]) || [];
        achievements.push({
          type: "goal_completed",
          timestamp: new Date().toISOString(),
          value: currentValue,
        });
        updateData.achievements = achievements;
      }

      await db
        .update(goalTable)
        .set(updateData)
        .where(eq(goalTable.id, input.goalId));

      await notifyGoalProgressChange({
        userId,
        goalId: goal.id,
        accountId: goal.accountId,
        goalTitle: goal.title,
        targetType: goal.targetType,
        previousValue,
        currentValue,
        targetValue: toNumber(goal.targetValue),
        achieved: isAchieved && goal.status === "active",
      });

      return { currentValue, isAchieved, ok: true };
    }),

  // Evaluate process goal progress automatically
  evaluateProcessGoals: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const conditions = [
        eq(goalTable.userId, userId),
        eq(goalTable.status, "active"),
        inArray(goalTable.targetType, PROCESS_TARGET_TYPES as unknown as string[]),
      ];
      if (input.accountId) {
        conditions.push(eq(goalTable.accountId, input.accountId));
      }

      const goals = await db
        .select()
        .from(goalTable)
        .where(and(...conditions));

      if (goals.length === 0) return { evaluated: 0 };

      const snapshot = await loadProcessSnapshot(userId, input.accountId);

      let evaluated = 0;

      for (const goal of goals) {
        const targetType = goal.targetType;
        let currentValue = 0;
        const previousValue = toNumber(goal.currentValue);
        const scopedMetrics = computeProcessMetrics(
          filterSnapshotByAccount(snapshot, goal.accountId)
        );

        switch (targetType) {
          case "journalRate": {
            currentValue = scopedMetrics.journalRate;
            break;
          }
          case "ruleCompliance": {
            currentValue = scopedMetrics.ruleCompliance;
            break;
          }
          case "edgeTradeRate": {
            currentValue = scopedMetrics.edgeTradeRate;
            break;
          }
          case "breakAfterLoss": {
            currentValue = scopedMetrics.breakAfterLoss;
            break;
          }
          case "checklistCompletion": {
            currentValue = scopedMetrics.checklistCompletion;
            break;
          }
          default:
            currentValue = toNumber(goal.currentValue);
        }

        // Update the goal progress
        const updateData: any = {
          currentValue: currentValue.toString(),
          updatedAt: new Date(),
        };

        const targetValue = parseFloat(goal.targetValue);
        if (currentValue >= targetValue && goal.status === "active") {
          updateData.status = "achieved";
          updateData.completedAt = new Date();
        }

        await db
          .update(goalTable)
          .set(updateData)
          .where(eq(goalTable.id, goal.id));

        await notifyGoalProgressChange({
          userId,
          goalId: goal.id,
          accountId: goal.accountId,
          goalTitle: goal.title,
          targetType: goal.targetType,
          previousValue,
          currentValue,
          targetValue,
          achieved: updateData.status === "achieved",
        });

        evaluated++;
      }

      return { evaluated };
    }),
});
