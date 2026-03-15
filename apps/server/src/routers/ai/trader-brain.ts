import { protectedProcedure } from "../../lib/trpc";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "../../db";
import { trade as tradeTable } from "../../db/schema/trading";
import { traderAlert, traderInsight } from "../../db/schema/trader-brain";
import {
  computeTraderProfile,
  condenseProfile,
  generateInsights,
  getFullProfile,
  monitorOpenTrades,
  saveAlerts,
  saveInsights,
} from "../../lib/ai/engine";
import { generateMeteredGeminiContent } from "../../lib/ai/gemini";
import { logAIProviderError } from "../../lib/ai/provider-errors";
import { orchestrateQuery } from "../../lib/ai/orchestrator";

function condenseForQuickQuery(markdown: string): string {
  let text = markdown
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^\|.*\|$/gm, "")
    .replace(/^\s*[-|:]+\s*$/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const noise =
    /^(sample size|breakdown|interpretation|suggested follow|based on|note:|caveat)/i;
  const meaningful = lines.filter(
    (line) => !noise.test(line) && line.length > 2
  );
  const answer = meaningful.slice(0, 2).join(" · ");

  return answer || text.slice(0, 200) || "No result found.";
}

export const aiTraderBrainProcedures = {
  generateGoal: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const recentTrades = await db
        .select()
        .from(tradeTable)
        .where(
          and(
            eq(tradeTable.accountId, input.accountId),
            gte(tradeTable.closeTime, last30Days)
          )
        )
        .limit(200);

      const uniqueSessions = new Set<string>();
      const uniqueModels = new Set<string>();
      const uniqueSymbols = new Set<string>();
      const sessionStats: Record<
        string,
        { total: number; wins: number; profit: number }
      > = {};
      const modelStats: Record<
        string,
        { total: number; wins: number; profit: number }
      > = {};
      const symbolStats: Record<
        string,
        { total: number; wins: number; profit: number }
      > = {};

      recentTrades.forEach((trade) => {
        const profit = parseFloat(trade.profit || "0");
        const isWin = profit > 0;

        if (trade.sessionTag) {
          uniqueSessions.add(trade.sessionTag);
          if (!sessionStats[trade.sessionTag]) {
            sessionStats[trade.sessionTag] = { total: 0, wins: 0, profit: 0 };
          }
          sessionStats[trade.sessionTag].total++;
          if (isWin) sessionStats[trade.sessionTag].wins++;
          sessionStats[trade.sessionTag].profit += profit;
        }

        if (trade.modelTag) {
          uniqueModels.add(trade.modelTag);
          if (!modelStats[trade.modelTag]) {
            modelStats[trade.modelTag] = { total: 0, wins: 0, profit: 0 };
          }
          modelStats[trade.modelTag].total++;
          if (isWin) modelStats[trade.modelTag].wins++;
          modelStats[trade.modelTag].profit += profit;
        }

        if (trade.symbol) {
          uniqueSymbols.add(trade.symbol);
          if (!symbolStats[trade.symbol]) {
            symbolStats[trade.symbol] = { total: 0, wins: 0, profit: 0 };
          }
          symbolStats[trade.symbol].total++;
          if (isWin) symbolStats[trade.symbol].wins++;
          symbolStats[trade.symbol].profit += profit;
        }
      });

      const totalTrades = recentTrades.length;
      const winningTrades = recentTrades.filter(
        (trade) => parseFloat(trade.profit || "0") > 0
      );
      const overallWinRate =
        totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
      const totalProfit = recentTrades.reduce(
        (sum, trade) => sum + parseFloat(trade.profit || "0"),
        0
      );

      const availableSessions = Array.from(uniqueSessions);
      const availableModels = Array.from(uniqueModels);
      const availableSymbols = Array.from(uniqueSymbols).slice(0, 10);

      let statsContext = `Overall (last 30 days):
- Total trades: ${totalTrades}
- Overall win rate: ${overallWinRate.toFixed(1)}%
- Total profit: $${totalProfit.toFixed(2)}
`;

      if (availableSessions.length > 0) {
        statsContext += `\nAvailable session tags:\n`;
        availableSessions.forEach((session) => {
          const stats = sessionStats[session];
          const winRate =
            stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
          statsContext += `- "${session}": ${
            stats.total
          } trades, ${winRate.toFixed(1)}% win rate, $${stats.profit.toFixed(
            2
          )} profit\n`;
        });
      }

      if (availableModels.length > 0) {
        statsContext += `\nAvailable Model Tags:\n`;
        availableModels.forEach((model) => {
          const stats = modelStats[model];
          const winRate =
            stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
          statsContext += `- "${model}": ${
            stats.total
          } trades, ${winRate.toFixed(1)}% win rate, $${stats.profit.toFixed(
            2
          )} profit\n`;
        });
      }

      if (availableSymbols.length > 0) {
        statsContext += `\nMost Traded Symbols:\n`;
        availableSymbols.forEach((symbol) => {
          const stats = symbolStats[symbol];
          const winRate =
            stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
          statsContext += `- ${symbol}: ${
            stats.total
          } trades, ${winRate.toFixed(1)}% win rate\n`;
        });
      }

      const systemPrompt = `You are a trading performance coach helping traders set SMART goals based on their actual trading data.

IMPORTANT: Only use filters that exist in the trader's data. Do not assume or suggest tags/sessions that aren't listed below.

Available filter types:
- session: Use EXACT session tag names from the list below (case-sensitive)
- model: Use EXACT model tag names from the list below (case-sensitive)
- symbol: Use symbols from the list below
- day: monday, tuesday, wednesday, thursday, friday
- direction: long, short

Available metrics: winRate, profit, avgRR, consistency, tradeCount, profitFactor, avgProfit, avgLoss
Available comparators: gte (target), increase (from baseline)
Goal types: weekly, monthly (preferred for most goals)

${statsContext}

Rules:
1. If user mentions a session/model/symbol NOT in the above lists, ask them to clarify or choose from available options
2. Use "increase" comparator with baselineValue when you have current stats
3. Calculate realistic targets (5-15% improvement from baseline)
4. Be conversational and helpful

Respond with a JSON object:
{
  "title": "Short, clear goal title",
  "type": "weekly|monthly|milestone",
  "criteria": {
    "filters": [{"type": "session", "value": "exact_tag_name", "operator": "is"}],
    "metric": "winRate",
    "comparator": "increase",
    "baselineValue": 52.5,
    "targetValue": 65.0,
    "description": "Human readable description"
  },
  "message": "Friendly message explaining the goal, current performance, and why this target is achievable"
}

If you need clarification:
{
  "message": "I found these sessions in your trading data: [list]. Which one did you mean?"
}`;

      try {
        const result = await generateMeteredGeminiContent({
          userId: ctx.session.user.id,
          accountId: input.accountId,
          featureKey: "assistant.goal.generate",
          model: "gemini-2.5-flash",
          request: {
          contents: [
            {
              role: "user",
              parts: [
                { text: `${systemPrompt}\n\nUser request: ${input.prompt}` },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
          },
        });

        const text = result.response.text();
        let jsonText = text;
        const codeBlockMatch = text.match(
          /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
        );

        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        } else {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }

        if (!jsonText || (jsonText === text && !text.includes("{"))) {
          return {
            message: `I see you have data for these sessions: ${
              availableSessions.join(", ") || "none yet"
            }. Which one would you like to improve?`,
            goal: null,
          };
        }

        const parsed = JSON.parse(jsonText);
        if (!parsed.criteria) {
          return {
            message:
              parsed.message ||
              "Could you be more specific about what you'd like to improve?",
            goal: null,
          };
        }

        return {
          message:
            parsed.message || "I've created a goal based on your trading data!",
          goal: {
            title: parsed.title,
            type: parsed.type,
            criteria: parsed.criteria,
          },
        };
      } catch (error) {
        logAIProviderError("Goal generation", error);

        if (availableSessions.length > 0) {
          return {
            message: `I had trouble processing that. I see you trade these sessions: ${availableSessions.join(
              ", "
            )}. Try: "Improve my ${availableSessions[0]} win rate"`,
            goal: null,
          };
        }

        return {
          message:
            "I couldn't find any tagged trades in your recent history. Try adding session or model tags to your trades first, or create a simple goal like 'Improve my overall win rate to 65%'",
          goal: null,
        };
      }
    }),

  getProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );
      if (!fullProfile) return null;

      const condensed = condenseProfile(
        fullProfile.profile,
        fullProfile.edges,
        fullProfile.leaks
      );

      return {
        profile: fullProfile.profile,
        condensed,
        edges: fullProfile.edges,
        leaks: fullProfile.leaks,
      };
    }),

  refreshProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await computeTraderProfile(
        input.accountId,
        ctx.session.user.id
      );
      return { success: true, totalTrades: profile.totalTrades };
    }),

  getEdgeConditions: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(
        input.accountId,
        ctx.session.user.id
      );
      if (!fullProfile) return { edges: [], leaks: [] };
      return { edges: fullProfile.edges, leaks: fullProfile.leaks };
    }),

  getInsights: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        unreadOnly: z.boolean().default(false),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(traderInsight.accountId, input.accountId),
        eq(traderInsight.userId, ctx.session.user.id),
        eq(traderInsight.isDismissed, false),
      ];

      if (input.unreadOnly) {
        conditions.push(eq(traderInsight.isRead, false));
      }

      const insights = await db
        .select()
        .from(traderInsight)
        .where(and(...conditions))
        .orderBy(desc(traderInsight.createdAt))
        .limit(input.limit);

      const [unreadResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(traderInsight)
        .where(
          and(
            eq(traderInsight.accountId, input.accountId),
            eq(traderInsight.userId, ctx.session.user.id),
            eq(traderInsight.isRead, false),
            eq(traderInsight.isDismissed, false)
          )
        );

      return {
        items: insights,
        unreadCount: Number(unreadResult?.count || 0),
      };
    }),

  markInsightRead: protectedProcedure
    .input(z.object({ insightId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(traderInsight)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(traderInsight.id, input.insightId),
            eq(traderInsight.userId, ctx.session.user.id)
          )
        );
      return { success: true };
    }),

  dismissInsight: protectedProcedure
    .input(z.object({ insightId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(traderInsight)
        .set({ isDismissed: true })
        .where(
          and(
            eq(traderInsight.id, input.insightId),
            eq(traderInsight.userId, ctx.session.user.id)
          )
        );
      return { success: true };
    }),

  getAlerts: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        unreadOnly: z.boolean().default(false),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(traderAlert.accountId, input.accountId),
        eq(traderAlert.userId, ctx.session.user.id),
        eq(traderAlert.isDismissed, false),
      ];

      if (input.unreadOnly) {
        conditions.push(eq(traderAlert.isRead, false));
      }

      const alerts = await db
        .select()
        .from(traderAlert)
        .where(and(...conditions))
        .orderBy(desc(traderAlert.createdAt))
        .limit(input.limit);

      return { items: alerts };
    }),

  checkOpenTrades: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alerts = await monitorOpenTrades(
        input.accountId,
        ctx.session.user.id
      );

      if (alerts.length > 0) {
        await saveAlerts(input.accountId, ctx.session.user.id, alerts);
      }

      return { alerts, count: alerts.length };
    }),

  generateInsightsManual: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const insights = await generateInsights(
        input.accountId,
        ctx.session.user.id,
        "manual"
      );

      if (insights.length > 0) {
        await saveInsights(
          input.accountId,
          ctx.session.user.id,
          insights,
          "manual"
        );
      }

      return { insights, count: insights.length };
    }),

  quickQuery: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await orchestrateQuery(input.message, {
        userId: ctx.session.user.id,
        accountId: input.accountId,
      });

      return {
        answer: condenseForQuickQuery(result.message),
        data: result.data,
        success: result.success,
      };
    }),
};
