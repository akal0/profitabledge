import { router, protectedProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { aiActionLog, aiReport, aiChatMessage } from "../db/schema/ai";
import { trade as tradeTable } from "../db/schema/trading";
import { traderInsight, traderAlert } from "../db/schema/trader-brain";
import {
  tradeEmotion,
  tradingRule,
  ruleViolation,
  tradeChecklistTemplate,
  tradeChecklistResult,
  traderDigest,
  traderMemory,
} from "../db/schema/coaching";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getOrComputeProfile,
  getFullProfile,
  condenseProfile,
  computeTraderProfile,
  generateInsights,
  generateTradeCloseInsights,
  saveInsights,
  monitorOpenTrades,
  saveAlerts,
  // Psychology
  computePsychologyProfile,
  detectTiltStatus,
  computeMentalPerformanceScore,
  // Digest
  generateMorningBriefing,
  generateTradeFeedback,
  checkAndGenerateMilestone,
  saveDigest,
  // Rules
  evaluateTradeAgainstRules,
  getDailyComplianceReport,
  generateSuggestedRules,
  // Risk
  runMonteCarloSimulation,
  calculateRiskOfRuin,
  computeDrawdownProfile,
  getPositionSizeRecommendations,
  // Session
  getCurrentSessionState,
  generateCoachingNudges,
  generateSessionSummary,
  // Memory
  getAllMemories,
  saveMemory,
  deleteMemory,
  updateMemory,
  getMemoryPromptContext,
} from "../lib/ai/engine";
import { orchestrateQuery, type OrchestratorContext } from "../lib/ai/orchestrator";

/**
 * Condense verbose orchestrator markdown into a short answer for the command palette.
 * Extracts just the direct answer — no headings, no tables, no breakdowns, no sample sizes.
 */
function condenseForQuickQuery(markdown: string, data?: any): string {
  // Strip markdown formatting
  let text = markdown
    .replace(/^#{1,6}\s+.*$/gm, "")            // remove heading lines entirely
    .replace(/\*\*(.+?)\*\*/g, "$1")            // bold → plain
    .replace(/\*(.+?)\*/g, "$1")                // italic → plain
    .replace(/`(.+?)`/g, "$1")                  // inline code → plain
    .replace(/^\|.*\|$/gm, "")                  // table rows
    .replace(/^\s*[-|:]+\s*$/gm, "")            // table separators
    .replace(/^[-*]\s+/gm, "")                  // list bullet prefixes
    .replace(/\n{2,}/g, "\n")                    // collapse blank lines
    .trim();

  // Split into non-empty lines
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Filter out noise lines (sample size, breakdown labels, suggested follow-ups)
  const noise = /^(sample size|breakdown|interpretation|suggested follow|based on|note:|caveat)/i;
  const meaningful = lines.filter((l) => !noise.test(l) && l.length > 2);

  // Take the first 1-2 meaningful lines — that's the direct answer
  const answer = meaningful.slice(0, 2).join(" · ");

  return answer || text.slice(0, 200) || "No result found.";
}

export const aiRouter = router({
  // Get action logs for user
  getLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        accountId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(aiActionLog.userId, ctx.session.user.id)];

      const logs = await db
        .select()
        .from(aiActionLog)
        .where(and(...conditions))
        .orderBy(desc(aiActionLog.startedAt))
        .limit(input.limit);

      return { items: logs };
    }),

  // Create action log
  createLog: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        intent: z.string(),
        userMessage: z.string(),
        messageId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [log] = await db
        .insert(aiActionLog)
        .values({
          id: crypto.randomUUID(),
          userId: ctx.session.user.id,
          title: input.title,
          intent: input.intent,
          userMessage: input.userMessage,
          messageId: input.messageId || null,
          status: "pending",
          startedAt: new Date(),
        })
        .returning();

      return log;
    }),

  // Update action log
  updateLog: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "running", "completed", "failed"]),
        error: z.string().optional(),
        result: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [log] = await db
        .update(aiActionLog)
        .set({
          status: input.status,
          error: input.error,
          result: input.result,
          completedAt:
            input.status === "completed" || input.status === "failed"
              ? new Date()
              : undefined,
        })
        .where(
          and(
            eq(aiActionLog.id, input.id),
            eq(aiActionLog.userId, ctx.session.user.id)
          )
        )
        .returning();

      return log;
    }),

  // Delete action log
  deleteLog: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(aiActionLog)
        .where(
          and(
            eq(aiActionLog.id, input.id),
            eq(aiActionLog.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  // Get chat reports (conversations)
  getReports: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        accountId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(aiReport.userId, ctx.session.user.id)];

      if (input.accountId) {
        conditions.push(eq(aiReport.accountId, input.accountId));
      }

      const reports = await db
        .select()
        .from(aiReport)
        .where(and(...conditions))
        .orderBy(desc(aiReport.updatedAt))
        .limit(input.limit);

      return { items: reports };
    }),

  // Create new chat report
  createReport: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        accountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [report] = await db
        .insert(aiReport)
        .values({
          id: crypto.randomUUID(),
          userId: ctx.session.user.id,
          accountId: input.accountId || null,
          title: input.title,
          description: input.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return report;
    }),

  // Update report
  updateReport: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [report] = await db
        .update(aiReport)
        .set({
          title: input.title,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiReport.id, input.id),
            eq(aiReport.userId, ctx.session.user.id)
          )
        )
        .returning();

      return report;
    }),

  // Delete report
  deleteReport: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(aiReport)
        .where(
          and(
            eq(aiReport.id, input.id),
            eq(aiReport.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  // Get messages for a report
  getMessages: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user owns this report
      const report = await db
        .select()
        .from(aiReport)
        .where(
          and(
            eq(aiReport.id, input.reportId),
            eq(aiReport.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (report.length === 0) {
        throw new Error("Report not found");
      }

      const messages = await db
        .select()
        .from(aiChatMessage)
        .where(eq(aiChatMessage.reportId, input.reportId))
        .orderBy(aiChatMessage.createdAt)
        .limit(input.limit);

      return { items: messages };
    }),

  // Add message to report
  addMessage: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        htmlContent: z.string().optional(),
        intent: z.string().optional(),
        confidence: z.string().optional(),
        data: z.any().optional(),
        status: z
          .enum(["pending", "running", "completed", "failed"])
          .optional(),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this report
      const report = await db
        .select()
        .from(aiReport)
        .where(
          and(
            eq(aiReport.id, input.reportId),
            eq(aiReport.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (report.length === 0) {
        throw new Error("Report not found");
      }

      const [message] = await db
        .insert(aiChatMessage)
        .values({
          id: crypto.randomUUID(),
          reportId: input.reportId,
          role: input.role,
          content: input.content,
          htmlContent: input.htmlContent,
          intent: input.intent,
          confidence: input.confidence,
          data: input.data,
          status: input.status || "completed",
          error: input.error,
          createdAt: new Date(),
        })
        .returning();

      // Update report timestamp
      await db
        .update(aiReport)
        .set({ updatedAt: new Date() })
        .where(eq(aiReport.id, input.reportId));

      return message;
    }),

  // Update message
  updateMessage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z
          .enum(["pending", "running", "completed", "failed"])
          .optional(),
        data: z.any().optional(),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [message] = await db
        .update(aiChatMessage)
        .set({
          status: input.status,
          data: input.data,
          error: input.error,
        })
        .where(eq(aiChatMessage.id, input.id))
        .returning();

      return message;
    }),

  // Generate a custom goal from natural language
  generateGoal: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Fetch recent trading data for context
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

      // Analyze user's actual trading data
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

        // Session tags
        if (trade.sessionTag) {
          uniqueSessions.add(trade.sessionTag);
          if (!sessionStats[trade.sessionTag]) {
            sessionStats[trade.sessionTag] = { total: 0, wins: 0, profit: 0 };
          }
          sessionStats[trade.sessionTag].total++;
          if (isWin) sessionStats[trade.sessionTag].wins++;
          sessionStats[trade.sessionTag].profit += profit;
        }

        // Model tags
        if (trade.modelTag) {
          uniqueModels.add(trade.modelTag);
          if (!modelStats[trade.modelTag]) {
            modelStats[trade.modelTag] = { total: 0, wins: 0, profit: 0 };
          }
          modelStats[trade.modelTag].total++;
          if (isWin) modelStats[trade.modelTag].wins++;
          modelStats[trade.modelTag].profit += profit;
        }

        // Symbols
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

      // Calculate overall stats
      const totalTrades = recentTrades.length;
      const winningTrades = recentTrades.filter(
        (t) => parseFloat(t.profit || "0") > 0
      );
      const overallWinRate =
        totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
      const totalProfit = recentTrades.reduce(
        (sum, t) => sum + parseFloat(t.profit || "0"),
        0
      );

      // Build context for AI
      const availableSessions = Array.from(uniqueSessions);
      const availableModels = Array.from(uniqueModels);
      const availableSymbols = Array.from(uniqueSymbols).slice(0, 10); // Top 10 symbols

      // Create detailed stats string
      let statsContext = `Overall (last 30 days):
- Total trades: ${totalTrades}
- Overall win rate: ${overallWinRate.toFixed(1)}%
- Total profit: $${totalProfit.toFixed(2)}
`;

      if (availableSessions.length > 0) {
        statsContext += `\nAvailable Session Tags:\n`;
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

      // Generate goal using AI with actual user data
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
        // Use the same Google AI SDK as the assistant
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent({
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
        });

        const text = result.response.text();

        // Parse the AI response - handle markdown code blocks
        let jsonText = text;

        // Remove markdown code blocks if present
        const codeBlockMatch = text.match(
          /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
        );
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        } else {
          // Try to extract JSON without code blocks
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
        console.error("[AI Goal Generator] Error details:", error);
        console.error(
          "[AI Goal Generator] Error stack:",
          error instanceof Error ? error.stack : "N/A"
        );

        // Return helpful context-specific error
        if (availableSessions.length > 0) {
          return {
            message: `I had trouble processing that. I see you trade these sessions: ${availableSessions.join(
              ", "
            )}. Try: "Improve my ${availableSessions[0]} win rate"`,
            goal: null,
          };
        } else {
          return {
            message:
              "I couldn't find any tagged trades in your recent history. Try adding session or model tags to your trades first, or create a simple goal like 'Improve my overall win rate to 65%'",
            goal: null,
          };
        }
      }
    }),

  // ─── Trader Brain Endpoints ──────────────────────────────────

  // Get trader profile for an account
  getProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const fullProfile = await getFullProfile(input.accountId, userId);
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

  // Force recompute the trader profile
  refreshProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const profile = await computeTraderProfile(input.accountId, userId);
      return { success: true, totalTrades: profile.totalTrades };
    }),

  // Get edge and leak conditions
  getEdgeConditions: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const fullProfile = await getFullProfile(input.accountId, userId);
      if (!fullProfile) return { edges: [], leaks: [] };
      return { edges: fullProfile.edges, leaks: fullProfile.leaks };
    }),

  // Get recent insights
  getInsights: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        unreadOnly: z.boolean().default(false),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const conditions = [
        eq(traderInsight.accountId, input.accountId),
        eq(traderInsight.userId, userId),
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

      // Count unread
      const [unreadResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(traderInsight)
        .where(
          and(
            eq(traderInsight.accountId, input.accountId),
            eq(traderInsight.userId, userId),
            eq(traderInsight.isRead, false),
            eq(traderInsight.isDismissed, false)
          )
        );

      return {
        items: insights,
        unreadCount: Number(unreadResult?.count || 0),
      };
    }),

  // Mark insight as read
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

  // Dismiss insight
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

  // Get live trade alerts
  getAlerts: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        unreadOnly: z.boolean().default(false),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const conditions = [
        eq(traderAlert.accountId, input.accountId),
        eq(traderAlert.userId, userId),
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

  // Trigger live trade monitoring
  checkOpenTrades: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const alerts = await monitorOpenTrades(input.accountId, userId);

      if (alerts.length > 0) {
        await saveAlerts(input.accountId, userId, alerts);
      }

      return { alerts, count: alerts.length };
    }),

  // Trigger insight generation manually
  generateInsightsManual: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const insights = await generateInsights(
        input.accountId,
        userId,
        "manual"
      );

      if (insights.length > 0) {
        await saveInsights(input.accountId, userId, insights, "manual");
      }

      return { insights, count: insights.length };
    }),

  // Quick query (lightweight, non-streaming) — returns a short one-liner answer
  quickQuery: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const result = await orchestrateQuery(input.message, {
        userId,
        accountId: input.accountId,
      });

      // Condense the verbose markdown into a short answer for the command palette
      const answer = condenseForQuickQuery(result.message, result.data);

      return {
        answer,
        data: result.data,
        success: result.success,
      };
    }),

  // ─── Emotion Tracking ──────────────────────────────────────────

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

  // ─── Psychology Engine ─────────────────────────────────────────

  getPsychologyProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const fullProfile = await getFullProfile(input.accountId, userId);
      if (!fullProfile) return null;
      return computePsychologyProfile(input.accountId, userId, fullProfile.profile);
    }),

  getTiltStatus: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const fullProfile = await getFullProfile(input.accountId, userId);
      if (!fullProfile) {
        return {
          score: 100,
          tiltScore: 0,
          level: "green" as const,
          indicators: [],
          recentEmotions: [],
        };
      }
      return detectTiltStatus(input.accountId, userId, fullProfile.profile);
    }),

  getMentalScore: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const fullProfile = await getFullProfile(input.accountId, userId);
      if (!fullProfile) return null;
      return computeMentalPerformanceScore(input.accountId, userId, fullProfile.profile);
    }),

  // ─── Trading Rules ─────────────────────────────────────────────

  getRules: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
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
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (input.label !== undefined) updates.label = input.label;
      if (input.description !== undefined) updates.description = input.description;
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
      const fullProfile = await getFullProfile(input.accountId, ctx.session.user.id);
      if (!fullProfile) return [];
      return generateSuggestedRules(fullProfile.profile, fullProfile.edges, fullProfile.leaks);
    }),

  getDailyCompliance: protectedProcedure
    .input(z.object({ accountId: z.string(), date: z.string().optional() }))
    .query(async ({ ctx, input }) => {
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

  // ─── Checklists ────────────────────────────────────────────────

  getChecklistTemplates: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
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

  // ─── Digests & Briefings ───────────────────────────────────────

  getDigests: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        type: z.enum(["morning", "evening", "weekly", "milestone", "trade_close"]).optional(),
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
      const digest = await generateMorningBriefing(input.accountId, ctx.session.user.id);
      if (!digest) return { success: false, message: "Not enough data for briefing" };
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
      return digest || null;
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

  // ─── Risk Intelligence ─────────────────────────────────────────

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
      const fullProfile = await getFullProfile(input.accountId, ctx.session.user.id);
      if (!fullProfile) return null;
      return calculateRiskOfRuin(fullProfile.profile, input.riskPerTrade, input.ruinThreshold);
    }),

  getDrawdownProfile: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      return computeDrawdownProfile(input.accountId, ctx.session.user.id);
    }),

  getPositionSizing: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(input.accountId, ctx.session.user.id);
      if (!fullProfile) return [];
      return getPositionSizeRecommendations(fullProfile.profile);
    }),

  // ─── Session Tracking ──────────────────────────────────────────

  getSessionState: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getCurrentSessionState(input.accountId, 8, ctx.session.user.id);
    }),

  getCoachingNudges: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(input.accountId, ctx.session.user.id);
      if (!fullProfile) return [];
      return generateCoachingNudges(input.accountId, ctx.session.user.id, fullProfile.profile);
    }),

  getSessionSummary: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fullProfile = await getFullProfile(input.accountId, ctx.session.user.id);
      if (!fullProfile) return null;
      return generateSessionSummary(input.accountId, fullProfile.profile);
    }),

  // ─── Long-Term Memory ──────────────────────────────────────────

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

  /**
   * Pattern Discovery Engine
   * Analyzes trade history to find hidden patterns across multiple dimensions
   */
  discoverPatterns: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get trades
      const trades = await db
        .select()
        .from(tradeTable)
        .where(
          and(
            eq(tradeTable.accountId, input.accountId),
          )
        );

      if (trades.length < 20) {
        return { patterns: [], message: "Need at least 20 trades for pattern discovery" };
      }

      // Analyze multiple dimensions
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

      // 1. Time-of-day patterns
      const hourBuckets: Record<string, { wins: number; losses: number; totalPnl: number; count: number }> = {};
      for (const t of trades) {
        if (!t.openTime) continue;
        const h = new Date(t.openTime).getHours();
        const bucket = `${h}:00-${h + 1}:00`;
        if (!hourBuckets[bucket]) hourBuckets[bucket] = { wins: 0, losses: 0, totalPnl: 0, count: 0 };
        const pnl = parseFloat(t.profit?.toString() || "0");
        hourBuckets[bucket].count++;
        hourBuckets[bucket].totalPnl += pnl;
        if (pnl > 0) hourBuckets[bucket].wins++;
        else hourBuckets[bucket].losses++;
      }

      for (const [hour, stats] of Object.entries(hourBuckets)) {
        if (stats.count < 5) continue;
        const wr = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;
        if (wr >= 70 || wr <= 30) {
          patterns.push({
            type: "time",
            title: `${hour} ${wr >= 70 ? "Sweet Spot" : "Danger Zone"}`,
            description: `${stats.count} trades at ${hour} have ${wr.toFixed(0)}% win rate (avg $${avgPnl.toFixed(2)})`,
            confidence: Math.min(stats.count / 20, 1),
            impact: wr >= 70 ? "positive" : "negative",
            trades: stats.count,
            winRate: wr,
            avgPnl,
          });
        }
      }

      // 2. Day-of-week patterns
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayBuckets: Record<number, { wins: number; losses: number; totalPnl: number; count: number }> = {};
      for (const t of trades) {
        if (!t.openTime) continue;
        const d = new Date(t.openTime).getDay();
        if (!dayBuckets[d]) dayBuckets[d] = { wins: 0, losses: 0, totalPnl: 0, count: 0 };
        const pnl = parseFloat(t.profit?.toString() || "0");
        dayBuckets[d].count++;
        dayBuckets[d].totalPnl += pnl;
        if (pnl > 0) dayBuckets[d].wins++;
        else dayBuckets[d].losses++;
      }

      for (const [day, stats] of Object.entries(dayBuckets)) {
        if (stats.count < 5) continue;
        const wr = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;
        if (wr >= 65 || wr <= 35) {
          patterns.push({
            type: "day",
            title: `${dayNames[Number(day)]}s ${wr >= 65 ? "are Strong" : "are Weak"}`,
            description: `${wr.toFixed(0)}% win rate on ${dayNames[Number(day)]}s across ${stats.count} trades`,
            confidence: Math.min(stats.count / 15, 1),
            impact: wr >= 65 ? "positive" : "negative",
            trades: stats.count,
            winRate: wr,
            avgPnl,
          });
        }
      }

      // 3. Symbol patterns
      const symbolBuckets: Record<string, { wins: number; losses: number; totalPnl: number; count: number }> = {};
      for (const t of trades) {
        const sym = t.symbol || "unknown";
        if (!symbolBuckets[sym]) symbolBuckets[sym] = { wins: 0, losses: 0, totalPnl: 0, count: 0 };
        const pnl = parseFloat(t.profit?.toString() || "0");
        symbolBuckets[sym].count++;
        symbolBuckets[sym].totalPnl += pnl;
        if (pnl > 0) symbolBuckets[sym].wins++;
        else symbolBuckets[sym].losses++;
      }

      for (const [sym, stats] of Object.entries(symbolBuckets)) {
        if (stats.count < 5) continue;
        const wr = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;
        if (wr >= 65 || wr <= 35) {
          patterns.push({
            type: "symbol",
            title: `${sym} is ${wr >= 65 ? "your edge" : "a leak"}`,
            description: `${wr.toFixed(0)}% win rate on ${sym} across ${stats.count} trades (avg $${avgPnl.toFixed(2)})`,
            confidence: Math.min(stats.count / 10, 1),
            impact: wr >= 65 ? "positive" : "negative",
            trades: stats.count,
            winRate: wr,
            avgPnl,
          });
        }
      }

      // 4. Session tag patterns
      const sessionBuckets: Record<string, { wins: number; losses: number; totalPnl: number; count: number }> = {};
      for (const t of trades) {
        const s = t.sessionTag || "untagged";
        if (!sessionBuckets[s]) sessionBuckets[s] = { wins: 0, losses: 0, totalPnl: 0, count: 0 };
        const pnl = parseFloat(t.profit?.toString() || "0");
        sessionBuckets[s].count++;
        sessionBuckets[s].totalPnl += pnl;
        if (pnl > 0) sessionBuckets[s].wins++;
        else sessionBuckets[s].losses++;
      }

      for (const [session, stats] of Object.entries(sessionBuckets)) {
        if (stats.count < 5 || session === "untagged") continue;
        const wr = (stats.wins / stats.count) * 100;
        const avgPnl = stats.totalPnl / stats.count;
        if (wr >= 65 || wr <= 35) {
          patterns.push({
            type: "session",
            title: `${session} session ${wr >= 65 ? "performs well" : "underperforms"}`,
            description: `${wr.toFixed(0)}% win rate in ${session} session across ${stats.count} trades`,
            confidence: Math.min(stats.count / 10, 1),
            impact: wr >= 65 ? "positive" : "negative",
            trades: stats.count,
            winRate: wr,
            avgPnl,
          });
        }
      }

      // 5. Streak patterns - do you revenge trade after losses?
      let currentStreak = 0;
      const sortedTrades = [...trades].sort(
        (a, b) => new Date(a.openTime!).getTime() - new Date(b.openTime!).getTime()
      );
      let afterLossWins = 0;
      let afterLossCount = 0;
      let afterWinWins = 0;
      let afterWinCount = 0;

      for (let i = 1; i < sortedTrades.length; i++) {
        const prevPnl = parseFloat(sortedTrades[i - 1].profit?.toString() || "0");
        const currPnl = parseFloat(sortedTrades[i].profit?.toString() || "0");

        if (prevPnl < 0) {
          afterLossCount++;
          if (currPnl > 0) afterLossWins++;
        } else if (prevPnl > 0) {
          afterWinCount++;
          if (currPnl > 0) afterWinWins++;
        }
      }

      if (afterLossCount >= 10) {
        const wr = (afterLossWins / afterLossCount) * 100;
        if (wr <= 35) {
          patterns.push({
            type: "streak",
            title: "Revenge Trading Pattern",
            description: `Only ${wr.toFixed(0)}% WR on trades immediately after a loss. Consider taking a break.`,
            confidence: Math.min(afterLossCount / 20, 1),
            impact: "negative",
            trades: afterLossCount,
            winRate: wr,
            avgPnl: 0,
          });
        }
      }

      if (afterWinCount >= 10) {
        const wr = (afterWinWins / afterWinCount) * 100;
        if (wr >= 65) {
          patterns.push({
            type: "streak",
            title: "Momentum Trader",
            description: `${wr.toFixed(0)}% WR after wins. You trade better when confident.`,
            confidence: Math.min(afterWinCount / 20, 1),
            impact: "positive",
            trades: afterWinCount,
            winRate: wr,
            avgPnl: 0,
          });
        }
      }

      // Sort patterns by confidence * impact
      patterns.sort((a, b) => {
        const aScore = a.confidence * (a.impact === "positive" ? 1 : a.impact === "negative" ? 0.9 : 0.5);
        const bScore = b.confidence * (b.impact === "positive" ? 1 : b.impact === "negative" ? 0.9 : 0.5);
        return bScore - aScore;
      });

      return { patterns: patterns.slice(0, 12) };
    }),

  /**
   * AI-Suggested Goals
   * Analyzes current performance to suggest specific, achievable goals
   */
  suggestGoals: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const trades = await db
        .select()
        .from(tradeTable)
        .where(eq(tradeTable.accountId, input.accountId));

      if (trades.length < 10) {
        return { suggestions: [] };
      }

      const pnls = trades.map((t) => parseFloat(t.profit?.toString() || "0"));
      const wins = pnls.filter((p) => p > 0).length;
      const winRate = (wins / trades.length) * 100;
      const rrs = trades
        .map((t) => parseFloat(t.realisedRR?.toString() || "0"))
        .filter((r) => r !== 0);
      const avgRR = rrs.length > 0 ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;
      const totalPnl = pnls.reduce((s, p) => s + p, 0);
      const grossWin = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
      const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0));
      const pf = grossLoss > 0 ? grossWin / grossLoss : 0;

      const suggestions: Array<{
        title: string;
        description: string;
        targetType: string;
        targetValue: number;
        timeframe: string;
        reason: string;
        difficulty: "easy" | "medium" | "hard";
      }> = [];

      // Win rate goal
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

      // RR goal
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

      // Profit factor goal
      if (pf > 0 && pf < 1.5) {
        suggestions.push({
          title: `Reach 1.5 Profit Factor`,
          description: `Current PF is ${pf.toFixed(2)}. Focus on cutting losers faster and riding winners.`,
          targetType: "profit",
          targetValue: 1.5,
          timeframe: "monthly",
          reason: "A PF above 1.5 indicates a robust trading edge",
          difficulty: "hard",
        });
      }

      // Consistency goal
      const dailyPnls: Record<string, number> = {};
      for (const t of trades) {
        if (!t.openTime) continue;
        const day = new Date(t.openTime).toISOString().split("T")[0];
        dailyPnls[day] = (dailyPnls[day] || 0) + parseFloat(t.profit?.toString() || "0");
      }
      const greenDays = Object.values(dailyPnls).filter((p) => p > 0).length;
      const totalDays = Object.keys(dailyPnls).length;
      const greenRate = totalDays > 0 ? (greenDays / totalDays) * 100 : 0;

      if (greenRate < 60 && totalDays >= 10) {
        suggestions.push({
          title: `Achieve 60% Green Days`,
          description: `Currently ${greenRate.toFixed(0)}% green days. Focus on discipline over big wins.`,
          targetType: "consistency",
          targetValue: 60,
          timeframe: "monthly",
          reason: "Consistent daily profitability builds confidence and compounds",
          difficulty: "medium",
        });
      }

      // Trade count goal (avoid overtrading)
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

      // Rule compliance goal
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

  /**
   * Strategy Template Library
   * Returns pre-built strategy templates traders can adopt based on their profile
   */
  getStrategyTemplates: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const templates = [
        {
          id: "ict-silver-bullet",
          name: "ICT Silver Bullet",
          category: "Intraday",
          description: "10am-11am NY time FVG entries targeting 1:3 RR. Works best on NAS100 and ES.",
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
          description: "Trade the first significant breakout of Asian range during London open. GBP/USD, EUR/USD focus.",
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
          description: "Fade London move during NY open. Look for liquidity sweeps and market structure shifts.",
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
          description: "Daily/H4 support/resistance bounce trades. Hold 1-5 days. Works across all forex majors.",
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
          description: "Quick scalps off session highs/lows with tight stops. 5-15 min holds.",
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
          description: "Conservative approach for prop challenges. Max 0.5% risk per trade, 2 trades/day.",
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

      // If accountId provided, mark which templates match their best sessions/models
      let recommended: string[] = [];
      if (input?.accountId) {
        const trades = await db
          .select({ sessionTag: tradeTable.sessionTag, profit: tradeTable.profit })
          .from(tradeTable)
          .where(eq(tradeTable.accountId, input.accountId));

        const sessionPnl: Record<string, number> = {};
        for (const t of trades) {
          if (!t.sessionTag) continue;
          sessionPnl[t.sessionTag] = (sessionPnl[t.sessionTag] || 0) + parseFloat(t.profit?.toString() || "0");
        }
        const bestSession = Object.entries(sessionPnl).sort((a, b) => b[1] - a[1])[0]?.[0];

        // Recommend templates whose session matches
        recommended = templates
          .filter((t) => {
            if (!bestSession) return false;
            const sessions = t.rules.allowedSessions;
            if (!sessions) return false;
            return sessions.some((s) => bestSession.toLowerCase().includes(s.toLowerCase()));
          })
          .map((t) => t.id);
      }

      return { templates, recommended };
    }),
});
