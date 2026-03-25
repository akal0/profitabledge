import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { traderDigest } from "../../db/schema/coaching";
import { trade as tradeTable } from "../../db/schema/trading";
import {
  calculateRiskOfRuin,
  computeDrawdownProfile,
  deleteMemory,
  generateCoachingNudges,
  generateMorningBriefing,
  generateSessionSummary,
  getAllMemories,
  getLatestBriefingReviewSnapshot,
  getCurrentSessionState,
  getFullProfile,
  getPositionSizeRecommendations,
  runMonteCarloSimulation,
  saveDigest,
  saveMemory,
  updateMemory,
} from "../../lib/ai/engine";
import { protectedProcedure } from "../../lib/trpc";

export const aiIntelligenceProcedures = {
  getDigests: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        type: z
          .enum(["morning", "evening", "weekly", "milestone", "trade_close"])
          .optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(traderDigest.accountId, input.accountId),
        eq(traderDigest.userId, ctx.session.user.id),
      ];

      if (input.type) {
        conditions.push(eq(traderDigest.digestType, input.type));
      }

      return db
        .select()
        .from(traderDigest)
        .where(and(...conditions))
        .orderBy(desc(traderDigest.createdAt))
        .limit(input.limit);
    }),

  generateBriefing: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const digest = await generateMorningBriefing(
        input.accountId,
        ctx.session.user.id
      );

      if (!digest) {
        return { success: false, message: "Not enough data for briefing" };
      }

      await saveDigest(digest);

      return { success: true, digest };
    }),

  getLatestBriefing: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [digest] = await db
        .select()
        .from(traderDigest)
        .where(
          and(
            eq(traderDigest.accountId, input.accountId),
            eq(traderDigest.userId, ctx.session.user.id),
            eq(traderDigest.digestType, "morning")
          )
        )
        .orderBy(desc(traderDigest.createdAt))
        .limit(1);

      if (!digest) {
        return null;
      }

      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      const reviewSnapshot = await getLatestBriefingReviewSnapshot(
        input.accountId,
        fullProfile?.edges ?? [],
        fullProfile?.leaks ?? []
      );

      return {
        ...digest,
        reviewSnapshot,
      };
    }),

  markDigestRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(traderDigest)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(traderDigest.id, input.id),
            eq(traderDigest.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  runSimulation: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        simulations: z.number().min(100).max(10000).default(5000),
        tradeCount: z.number().min(10).max(500).default(100),
        startingEquity: z.number().min(100).default(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return runMonteCarloSimulation(
        input.accountId,
        {
          simulations: input.simulations,
          tradeCount: input.tradeCount,
          startingEquity: input.startingEquity,
        },
        ctx.session.user.id
      );
    }),

  getRiskOfRuin: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        riskPerTrade: z.number().min(0.1).max(50).default(2),
        ruinThreshold: z.number().min(10).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return null;
      }

      return calculateRiskOfRuin(
        fullProfile.profile,
        input.riskPerTrade,
        input.ruinThreshold
      );
    }),

  getDrawdownProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      return computeDrawdownProfile(input.accountId, ctx.session.user.id);
    }),

  getPositionSizing: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return [];
      }

      return getPositionSizeRecommendations(fullProfile.profile);
    }),

  getSessionState: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getCurrentSessionState(input.accountId, 8, ctx.session.user.id);
    }),

  getCoachingNudges: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return [];
      }

      return generateCoachingNudges(
        input.accountId,
        ctx.session.user.id,
        fullProfile.profile
      );
    }),

  getSessionSummary: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );

      if (!fullProfile) {
        return null;
      }

      return generateSessionSummary(input.accountId, fullProfile.profile);
    }),

  getMemories: protectedProcedure.query(async ({ ctx }) => {
    return getAllMemories(ctx.session.user.id);
  }),

  addMemory: protectedProcedure
    .input(
      z.object({
        category: z.enum(["preference", "goal", "context", "instruction"]),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await saveMemory(
        ctx.session.user.id,
        input.category,
        input.content,
        "user_stated",
        1.0
      );

      return { success: true };
    }),

  updateMemoryEntry: protectedProcedure
    .input(z.object({ id: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await updateMemory(ctx.session.user.id, input.id, input.content);
      return { success: true };
    }),

  deleteMemoryEntry: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteMemory(ctx.session.user.id, input.id);
      return { success: true };
    }),

  discoverPatterns: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const trades = await db
        .select()
        .from(tradeTable)
        .where(and(eq(tradeTable.accountId, input.accountId)));

      if (trades.length < 20) {
        return {
          patterns: [],
          message: "Need at least 20 trades for pattern discovery",
        };
      }

      const patterns: Array<{
        type: "time" | "symbol" | "session" | "streak" | "size" | "day";
        title: string;
        description: string;
        confidence: number;
        impact: "positive" | "negative" | "neutral";
        trades: number;
        winRate: number;
        avgPnl: number;
      }> = [];

      const hourBuckets: Record<
        string,
        { wins: number; losses: number; totalPnl: number; count: number }
      > = {};

      for (const trade of trades) {
        if (!trade.openTime) continue;

        const hour = new Date(trade.openTime).getHours();
        const bucket = `${hour}:00-${hour + 1}:00`;

        if (!hourBuckets[bucket]) {
          hourBuckets[bucket] = { wins: 0, losses: 0, totalPnl: 0, count: 0 };
        }

        const pnl = parseFloat(trade.profit?.toString() || "0");

        hourBuckets[bucket].count++;
        hourBuckets[bucket].totalPnl += pnl;

        if (pnl > 0) {
          hourBuckets[bucket].wins++;
        } else {
          hourBuckets[bucket].losses++;
        }
      }

      for (const [hour, stats] of Object.entries(hourBuckets)) {
        if (stats.count < 5) continue;

        const winRate = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;

        if (winRate >= 70 || winRate <= 30) {
          patterns.push({
            type: "time",
            title: `${hour} ${winRate >= 70 ? "Sweet Spot" : "Danger Zone"}`,
            description: `${stats.count} trades at ${hour} have ${winRate.toFixed(0)}% win rate (avg $${avgPnl.toFixed(2)})`,
            confidence: Math.min(stats.count / 20, 1),
            impact: winRate >= 70 ? "positive" : "negative",
            trades: stats.count,
            winRate,
            avgPnl,
          });
        }
      }

      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayBuckets: Record<
        number,
        { wins: number; losses: number; totalPnl: number; count: number }
      > = {};

      for (const trade of trades) {
        if (!trade.openTime) continue;

        const day = new Date(trade.openTime).getDay();

        if (!dayBuckets[day]) {
          dayBuckets[day] = { wins: 0, losses: 0, totalPnl: 0, count: 0 };
        }

        const pnl = parseFloat(trade.profit?.toString() || "0");

        dayBuckets[day].count++;
        dayBuckets[day].totalPnl += pnl;

        if (pnl > 0) {
          dayBuckets[day].wins++;
        } else {
          dayBuckets[day].losses++;
        }
      }

      for (const [day, stats] of Object.entries(dayBuckets)) {
        if (stats.count < 5) continue;

        const winRate = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;

        if (winRate >= 65 || winRate <= 35) {
          patterns.push({
            type: "day",
            title: `${dayNames[Number(day)]}s ${winRate >= 65 ? "are Strong" : "are Weak"}`,
            description: `${winRate.toFixed(0)}% win rate on ${dayNames[Number(day)]}s across ${stats.count} trades`,
            confidence: Math.min(stats.count / 15, 1),
            impact: winRate >= 65 ? "positive" : "negative",
            trades: stats.count,
            winRate,
            avgPnl,
          });
        }
      }

      const symbolBuckets: Record<
        string,
        { wins: number; losses: number; totalPnl: number; count: number }
      > = {};

      for (const trade of trades) {
        const symbol = trade.symbol || "unknown";

        if (!symbolBuckets[symbol]) {
          symbolBuckets[symbol] = { wins: 0, losses: 0, totalPnl: 0, count: 0 };
        }

        const pnl = parseFloat(trade.profit?.toString() || "0");

        symbolBuckets[symbol].count++;
        symbolBuckets[symbol].totalPnl += pnl;

        if (pnl > 0) {
          symbolBuckets[symbol].wins++;
        } else {
          symbolBuckets[symbol].losses++;
        }
      }

      for (const [symbol, stats] of Object.entries(symbolBuckets)) {
        if (stats.count < 5) continue;

        const winRate = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;

        if (winRate >= 65 || winRate <= 35) {
          patterns.push({
            type: "symbol",
            title: `${symbol} is ${winRate >= 65 ? "your edge" : "a leak"}`,
            description: `${winRate.toFixed(0)}% win rate on ${symbol} across ${stats.count} trades (avg $${avgPnl.toFixed(2)})`,
            confidence: Math.min(stats.count / 10, 1),
            impact: winRate >= 65 ? "positive" : "negative",
            trades: stats.count,
            winRate,
            avgPnl,
          });
        }
      }

      const sessionBuckets: Record<
        string,
        { wins: number; losses: number; totalPnl: number; count: number }
      > = {};

      for (const trade of trades) {
        const session = trade.sessionTag || "untagged";

        if (!sessionBuckets[session]) {
          sessionBuckets[session] = {
            wins: 0,
            losses: 0,
            totalPnl: 0,
            count: 0,
          };
        }

        const pnl = parseFloat(trade.profit?.toString() || "0");

        sessionBuckets[session].count++;
        sessionBuckets[session].totalPnl += pnl;

        if (pnl > 0) {
          sessionBuckets[session].wins++;
        } else {
          sessionBuckets[session].losses++;
        }
      }

      for (const [session, stats] of Object.entries(sessionBuckets)) {
        if (stats.count < 5 || session === "untagged") continue;

        const winRate = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;

        if (winRate >= 65 || winRate <= 35) {
          patterns.push({
            type: "session",
            title: `${session} session ${winRate >= 65 ? "performs well" : "underperforms"}`,
            description: `${winRate.toFixed(0)}% win rate in ${session} session across ${stats.count} trades`,
            confidence: Math.min(stats.count / 10, 1),
            impact: winRate >= 65 ? "positive" : "negative",
            trades: stats.count,
            winRate,
            avgPnl,
          });
        }
      }

      const sortedTrades = [...trades].sort(
        (left, right) =>
          new Date(left.openTime!).getTime() - new Date(right.openTime!).getTime()
      );
      let afterLossWins = 0;
      let afterLossCount = 0;
      let afterWinWins = 0;
      let afterWinCount = 0;

      for (let index = 1; index < sortedTrades.length; index++) {
        const previousPnl = parseFloat(
          sortedTrades[index - 1].profit?.toString() || "0"
        );
        const currentPnl = parseFloat(
          sortedTrades[index].profit?.toString() || "0"
        );

        if (previousPnl < 0) {
          afterLossCount++;
          if (currentPnl > 0) afterLossWins++;
        } else if (previousPnl > 0) {
          afterWinCount++;
          if (currentPnl > 0) afterWinWins++;
        }
      }

      if (afterLossCount >= 10) {
        const winRate = (afterLossWins / afterLossCount) * 100;

        if (winRate <= 35) {
          patterns.push({
            type: "streak",
            title: "Revenge Trading Pattern",
            description: `Only ${winRate.toFixed(0)}% WR on trades immediately after a loss. Consider taking a break.`,
            confidence: Math.min(afterLossCount / 20, 1),
            impact: "negative",
            trades: afterLossCount,
            winRate,
            avgPnl: 0,
          });
        }
      }

      if (afterWinCount >= 10) {
        const winRate = (afterWinWins / afterWinCount) * 100;

        if (winRate >= 65) {
          patterns.push({
            type: "streak",
            title: "Momentum Trader",
            description: `${winRate.toFixed(0)}% WR after wins. You trade better when confident.`,
            confidence: Math.min(afterWinCount / 20, 1),
            impact: "positive",
            trades: afterWinCount,
            winRate,
            avgPnl: 0,
          });
        }
      }

      patterns.sort((left, right) => {
        const leftScore =
          left.confidence *
          (left.impact === "positive"
            ? 1
            : left.impact === "negative"
              ? 0.9
              : 0.5);
        const rightScore =
          right.confidence *
          (right.impact === "positive"
            ? 1
            : right.impact === "negative"
              ? 0.9
              : 0.5);

        return rightScore - leftScore;
      });

      return { patterns: patterns.slice(0, 12) };
    }),

  suggestGoals: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const trades = await db
        .select()
        .from(tradeTable)
        .where(eq(tradeTable.accountId, input.accountId));

      if (trades.length < 10) {
        return { suggestions: [] };
      }

      const pnls = trades.map((trade) => parseFloat(trade.profit?.toString() || "0"));
      const wins = pnls.filter((pnl) => pnl > 0).length;
      const winRate = (wins / trades.length) * 100;
      const rrs = trades
        .map((trade) => parseFloat(trade.realisedRR?.toString() || "0"))
        .filter((rr) => rr !== 0);
      const avgRR =
        rrs.length > 0 ? rrs.reduce((sum, rr) => sum + rr, 0) / rrs.length : 0;
      const grossWin = pnls.filter((pnl) => pnl > 0).reduce((sum, pnl) => sum + pnl, 0);
      const grossLoss = Math.abs(
        pnls.filter((pnl) => pnl < 0).reduce((sum, pnl) => sum + pnl, 0)
      );
      const profitFactor = grossLoss > 0 ? grossWin / grossLoss : 0;

      const suggestions: Array<{
        title: string;
        description: string;
        targetType: string;
        targetValue: number;
        timeframe: string;
        reason: string;
        difficulty: "easy" | "medium" | "hard";
      }> = [];

      if (winRate < 55) {
        suggestions.push({
          title: `Reach ${Math.ceil(winRate + 5)}% Win Rate`,
          description: `Your current win rate is ${winRate.toFixed(1)}%. A 5% improvement would significantly impact profitability.`,
          targetType: "winRate",
          targetValue: Math.ceil(winRate + 5),
          timeframe: "monthly",
          reason: "A small win rate improvement compounds over many trades",
          difficulty: "medium",
        });
      }

      if (avgRR < 1.5 && avgRR > 0) {
        suggestions.push({
          title: "Improve Average R:R to 1.5",
          description: `Your avg R:R is ${avgRR.toFixed(2)}. Holding winners longer or tightening stops can improve this.`,
          targetType: "rr",
          targetValue: 1.5,
          timeframe: "monthly",
          reason: "Higher R:R means you need fewer wins to be profitable",
          difficulty: "medium",
        });
      }

      if (profitFactor > 0 && profitFactor < 1.5) {
        suggestions.push({
          title: "Reach 1.5 Profit Factor",
          description: `Current PF is ${profitFactor.toFixed(2)}. Focus on cutting losers faster and riding winners.`,
          targetType: "profit",
          targetValue: 1.5,
          timeframe: "monthly",
          reason: "A PF above 1.5 indicates a robust trading edge",
          difficulty: "hard",
        });
      }

      const dailyPnls: Record<string, number> = {};

      for (const trade of trades) {
        if (!trade.openTime) continue;

        const day = new Date(trade.openTime).toISOString().split("T")[0];
        dailyPnls[day] = (dailyPnls[day] || 0) + parseFloat(trade.profit?.toString() || "0");
      }

      const greenDays = Object.values(dailyPnls).filter((pnl) => pnl > 0).length;
      const totalDays = Object.keys(dailyPnls).length;
      const greenRate = totalDays > 0 ? (greenDays / totalDays) * 100 : 0;

      if (greenRate < 60 && totalDays >= 10) {
        suggestions.push({
          title: "Achieve 60% Green Days",
          description: `Currently ${greenRate.toFixed(0)}% green days. Focus on discipline over big wins.`,
          targetType: "consistency",
          targetValue: 60,
          timeframe: "monthly",
          reason: "Consistent daily profitability builds confidence and compounds",
          difficulty: "medium",
        });
      }

      const avgDailyTrades = trades.length / Math.max(totalDays, 1);

      if (avgDailyTrades > 5) {
        suggestions.push({
          title: "Limit to 5 Trades Per Day",
          description: `Averaging ${avgDailyTrades.toFixed(1)} trades/day. Quality over quantity will improve edge.`,
          targetType: "trades",
          targetValue: 5,
          timeframe: "daily",
          reason: "Overtrading dilutes your edge and increases costs",
          difficulty: "easy",
        });
      }

      suggestions.push({
        title: "100% SL Compliance",
        description: "Every trade should have a stop loss set before entry.",
        targetType: "ruleCompliance",
        targetValue: 100,
        timeframe: "weekly",
        reason: "Protecting capital is the #1 rule of professional trading",
        difficulty: "easy",
      });

      return { suggestions: suggestions.slice(0, 5) };
    }),

  getStrategyTemplates: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const templates = [
        {
          id: "ict-silver-bullet",
          name: "ICT Silver Bullet",
          category: "Intraday",
          description:
            "10am-11am NY time FVG entries targeting 1:3 RR. Works best on NAS100 and ES.",
          rules: {
            allowedSessions: ["New York AM"],
            minPlannedRR: 2,
            maxDailyTrades: 2,
            requireSL: true,
            requireTP: true,
          },
          tags: { session: "New York AM", model: "Silver Bullet" },
          expectedWinRate: "45-55%",
          expectedRR: "1:3",
          difficulty: "intermediate" as const,
        },
        {
          id: "london-breakout",
          name: "London Breakout",
          category: "Intraday",
          description:
            "Trade the first significant breakout of Asian range during London open. GBP/USD, EUR/USD focus.",
          rules: {
            allowedSessions: ["London"],
            maxDailyTrades: 1,
            requireSL: true,
            requireTP: true,
            minPlannedRR: 1.5,
          },
          tags: { session: "London", model: "Breakout" },
          expectedWinRate: "50-60%",
          expectedRR: "1:2",
          difficulty: "beginner" as const,
        },
        {
          id: "ny-reversal",
          name: "NY Session Reversal",
          category: "Intraday",
          description:
            "Fade London move during NY open. Look for liquidity sweeps and market structure shifts.",
          rules: {
            allowedSessions: ["New York AM"],
            maxDailyTrades: 2,
            requireSL: true,
            minPlannedRR: 2,
          },
          tags: { session: "New York AM", model: "Reversal" },
          expectedWinRate: "40-50%",
          expectedRR: "1:3",
          difficulty: "advanced" as const,
        },
        {
          id: "swing-support-resistance",
          name: "Swing S/R Bounce",
          category: "Swing",
          description:
            "Daily/H4 support/resistance bounce trades. Hold 1-5 days. Works across all forex majors.",
          rules: {
            minPlannedRR: 2,
            maxConcurrentTrades: 3,
            requireSL: true,
            requireTP: true,
          },
          tags: { model: "S/R Bounce" },
          expectedWinRate: "45-55%",
          expectedRR: "1:2.5",
          difficulty: "intermediate" as const,
        },
        {
          id: "scalp-session-high-low",
          name: "Session High/Low Scalp",
          category: "Scalp",
          description:
            "Quick scalps off session highs/lows with tight stops. 5-15 min holds.",
          rules: {
            maxDailyTrades: 10,
            requireSL: true,
            maxHoldSeconds: 900,
            maxEntrySpreadPips: 1.5,
          },
          tags: { model: "Session HL Scalp" },
          expectedWinRate: "55-65%",
          expectedRR: "1:1.5",
          difficulty: "advanced" as const,
        },
        {
          id: "prop-conservative",
          name: "Prop Challenge Safe",
          category: "Prop Firm",
          description:
            "Conservative approach for prop challenges. Max 0.5% risk per trade, 2 trades/day.",
          rules: {
            maxDailyTrades: 2,
            maxPositionSizePercent: 0.5,
            maxDailyLossPercent: 2,
            requireSL: true,
            requireTP: true,
            minPlannedRR: 2,
          },
          tags: { model: "Prop Safe" },
          expectedWinRate: "45-55%",
          expectedRR: "1:2",
          difficulty: "intermediate" as const,
        },
      ];

      let recommended: string[] = [];

      if (input?.accountId) {
        const trades = await db
          .select({
            sessionTag: tradeTable.sessionTag,
            profit: tradeTable.profit,
          })
          .from(tradeTable)
          .where(eq(tradeTable.accountId, input.accountId));

        const sessionPnl: Record<string, number> = {};

        for (const trade of trades) {
          if (!trade.sessionTag) continue;
          sessionPnl[trade.sessionTag] =
            (sessionPnl[trade.sessionTag] || 0) +
            parseFloat(trade.profit?.toString() || "0");
        }

        const bestSession = Object.entries(sessionPnl).sort(
          (left, right) => right[1] - left[1]
        )[0]?.[0];

        recommended = templates
          .filter((template) => {
            if (!bestSession) return false;

            const sessions = template.rules.allowedSessions;
            if (!sessions) return false;

            return sessions.some((session) =>
              bestSession.toLowerCase().includes(session.toLowerCase())
            );
          })
          .map((template) => template.id);
      }

      return { templates, recommended };
    }),
};
