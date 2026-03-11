import { router, protectedProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { backtestSession, backtestTrade } from "../db/schema/backtest";
import { journalEntry } from "../db/schema/journal";
import { tradingRuleSet } from "../db/schema/trading";
import { and, desc, eq, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { compareBacktestToLive } from "../lib/backtest-profile-comparison";
import { evaluateCompliance, type ComplianceRules } from "../lib/compliance-audits";

// Helper to serialize Date fields to ISO strings for JSON transport (no superjson)
function serializeSession(s: any) {
  return {
    ...s,
    startDate: s.startDate instanceof Date ? s.startDate.toISOString() : s.startDate ?? null,
    endDate: s.endDate instanceof Date ? s.endDate.toISOString() : s.endDate ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    completedAt: s.completedAt instanceof Date ? s.completedAt.toISOString() : s.completedAt ?? null,
  };
}

function serializeTrade(t: any) {
  return {
    ...t,
    entryTime: t.entryTime instanceof Date ? t.entryTime.toISOString() : t.entryTime,
    exitTime: t.exitTime instanceof Date ? t.exitTime.toISOString() : t.exitTime ?? null,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

const replayWorkspaceStateSchema = z.record(z.string(), z.unknown());
const replaySimulationConfigSchema = z.record(z.string(), z.unknown());

async function assertOwnedRuleSet(userId: string, ruleSetId: string | null | undefined) {
  if (!ruleSetId) return null;

  const [ruleSet] = await db
    .select({
      id: tradingRuleSet.id,
      userId: tradingRuleSet.userId,
      name: tradingRuleSet.name,
      description: tradingRuleSet.description,
      rules: tradingRuleSet.rules,
    })
    .from(tradingRuleSet)
    .where(and(eq(tradingRuleSet.id, ruleSetId), eq(tradingRuleSet.userId, userId)))
    .limit(1);

  if (!ruleSet) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Rule set not found" });
  }

  return ruleSet;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveBacktestSessionTag(entryTime: Date) {
  const hour = entryTime.getUTCHours();
  if (hour >= 13 && hour < 16) return "London / New York";
  if (hour >= 7 && hour < 11) return "London";
  if (hour >= 12 && hour < 20) return "New York";
  if (hour >= 0 && hour < 6) return "Asia";
  return "Core";
}

function extractBacktestTag(tags: unknown, prefix: string) {
  if (!Array.isArray(tags)) return null;
  const match = tags.find(
    (value): value is string => typeof value === "string" && value.startsWith(prefix)
  );
  return match ? match.slice(prefix.length) : null;
}

export const backtestRouter = router({
  // ============== SESSION CRUD ==============

  createSession: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        symbol: z.string().min(1).max(64),
        timeframe: z.enum(["m1", "m5", "m15", "m30", "h1", "h4", "d1"]),
        startDate: z.string(), // ISO date
        endDate: z.string(), // ISO date
        initialBalance: z.number().positive().default(10000),
        currency: z.string().max(8).default("USD"),
        riskPercent: z.number().min(0.01).max(100).default(1),
        defaultSLPips: z.number().int().positive().optional().default(20),
        defaultTPPips: z.number().int().positive().optional().default(40),
        dataSource: z.enum(["dukascopy", "simulated", "ea_candles"]).default("dukascopy"),
        candleSourceId: z.string().optional(),
        linkedRuleSetId: z.string().nullable().optional(),
        workspaceState: replayWorkspaceStateSchema.optional(),
        simulationConfig: replaySimulationConfigSchema.optional(),
        indicatorConfig: z
          .object({
            sma1: z.object({ enabled: z.boolean(), period: z.number(), color: z.string() }).optional(),
            sma2: z.object({ enabled: z.boolean(), period: z.number(), color: z.string() }).optional(),
            ema1: z.object({ enabled: z.boolean(), period: z.number(), color: z.string() }).optional(),
            rsi: z.object({ enabled: z.boolean(), period: z.number() }).optional(),
            macd: z.object({ enabled: z.boolean(), fastPeriod: z.number(), slowPeriod: z.number(), signalPeriod: z.number() }).optional(),
            bb: z.object({ enabled: z.boolean(), period: z.number(), stdDev: z.number() }).optional(),
            atr: z.object({ enabled: z.boolean(), period: z.number() }).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.linkedRuleSetId) {
        await assertOwnedRuleSet(ctx.session.user.id, input.linkedRuleSetId);
      }

      const [session] = await db
        .insert(backtestSession)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          symbol: input.symbol,
          timeframe: input.timeframe,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          initialBalance: String(input.initialBalance),
          currency: input.currency,
          riskPercent: String(input.riskPercent),
          defaultSLPips: input.defaultSLPips,
          defaultTPPips: input.defaultTPPips,
          dataSource: input.dataSource,
          candleSourceId: input.candleSourceId,
          linkedRuleSetId: input.linkedRuleSetId ?? null,
          workspaceState: input.workspaceState,
          simulationConfig: input.simulationConfig,
          indicatorConfig: input.indicatorConfig,
          status: "active",
        })
        .returning();

      return serializeSession(session);
    }),

  listSessions: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "completed", "archived"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = [eq(backtestSession.userId, ctx.session.user.id)];
      if (input?.status) {
        filters.push(eq(backtestSession.status, input.status));
      } else {
        // Exclude archived by default
        filters.push(sql`${backtestSession.status} != 'archived'`);
      }

      const sessions = await db
        .select({
          id: backtestSession.id,
          name: backtestSession.name,
          symbol: backtestSession.symbol,
          timeframe: backtestSession.timeframe,
          status: backtestSession.status,
          startDate: backtestSession.startDate,
          endDate: backtestSession.endDate,
          initialBalance: backtestSession.initialBalance,
          finalBalance: backtestSession.finalBalance,
          totalPnL: backtestSession.totalPnL,
          totalPnLPercent: backtestSession.totalPnLPercent,
          totalTrades: backtestSession.totalTrades,
          winRate: backtestSession.winRate,
          profitFactor: backtestSession.profitFactor,
          maxDrawdownPercent: backtestSession.maxDrawdownPercent,
          dataSource: backtestSession.dataSource,
          createdAt: backtestSession.createdAt,
          updatedAt: backtestSession.updatedAt,
          completedAt: backtestSession.completedAt,
        })
        .from(backtestSession)
        .where(and(...filters))
        .orderBy(desc(backtestSession.updatedAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      return sessions.map(serializeSession);
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(backtestSession)
        .where(
          and(
            eq(backtestSession.id, input.sessionId),
            eq(backtestSession.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Also fetch trades for this session
      const trades = await db
        .select()
        .from(backtestTrade)
        .where(eq(backtestTrade.sessionId, input.sessionId))
        .orderBy(asc(backtestTrade.entryTime));

      return { ...serializeSession(session), trades: trades.map(serializeTrade) };
    }),

  updateSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        symbol: z.string().min(1).max(64).optional(),
        timeframe: z.enum(["m1", "m5", "m15", "m30", "h1", "h4", "d1"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        lastCandleIndex: z.number().int().min(0).optional(),
        playbackSpeed: z.number().positive().optional(),
        linkedRuleSetId: z.string().nullable().optional(),
        workspaceState: replayWorkspaceStateSchema.optional(),
        simulationConfig: replaySimulationConfigSchema.optional(),
        indicatorConfig: z.any().optional(),
        riskPercent: z.number().min(0.01).max(100).optional(),
        defaultSLPips: z.number().int().positive().optional(),
        defaultTPPips: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select({ id: backtestSession.id })
        .from(backtestSession)
        .where(
          and(
            eq(backtestSession.id, sessionId),
            eq(backtestSession.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      if (updates.linkedRuleSetId) {
        await assertOwnedRuleSet(ctx.session.user.id, updates.linkedRuleSetId);
      }

      const updateValues: Record<string, any> = { updatedAt: new Date() };
      if (updates.name !== undefined) updateValues.name = updates.name;
      if (updates.description !== undefined) updateValues.description = updates.description;
      if (updates.symbol !== undefined) updateValues.symbol = updates.symbol;
      if (updates.timeframe !== undefined) updateValues.timeframe = updates.timeframe;
      if (updates.startDate !== undefined) updateValues.startDate = new Date(updates.startDate);
      if (updates.endDate !== undefined) updateValues.endDate = new Date(updates.endDate);
      if (updates.lastCandleIndex !== undefined) updateValues.lastCandleIndex = updates.lastCandleIndex;
      if (updates.playbackSpeed !== undefined) updateValues.playbackSpeed = String(updates.playbackSpeed);
      if (updates.linkedRuleSetId !== undefined) updateValues.linkedRuleSetId = updates.linkedRuleSetId;
      if (updates.workspaceState !== undefined) updateValues.workspaceState = updates.workspaceState;
      if (updates.simulationConfig !== undefined) updateValues.simulationConfig = updates.simulationConfig;
      if (updates.indicatorConfig !== undefined) updateValues.indicatorConfig = updates.indicatorConfig;
      if (updates.riskPercent !== undefined) updateValues.riskPercent = String(updates.riskPercent);
      if (updates.defaultSLPips !== undefined) updateValues.defaultSLPips = updates.defaultSLPips;
      if (updates.defaultTPPips !== undefined) updateValues.defaultTPPips = updates.defaultTPPips;

      const [updated] = await db
        .update(backtestSession)
        .set(updateValues)
        .where(eq(backtestSession.id, sessionId))
        .returning();

      return serializeSession(updated);
    }),

  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [session] = await db
        .select()
        .from(backtestSession)
        .where(
          and(
            eq(backtestSession.id, input.sessionId),
            eq(backtestSession.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Close any remaining open trades (mark as manual close)
      await db
        .update(backtestTrade)
        .set({ status: "closed", exitType: "session_end" })
        .where(
          and(
            eq(backtestTrade.sessionId, input.sessionId),
            eq(backtestTrade.status, "open")
          )
        );

      // Re-query after closing open trades so the final snapshot is consistent.
      const trades = await db
        .select()
        .from(backtestTrade)
        .where(
          and(
            eq(backtestTrade.sessionId, input.sessionId),
            sql`${backtestTrade.status} != 'open'`
          )
        )
        .orderBy(asc(backtestTrade.entryTime));

      // Calculate stats
      const stats = calculateSessionStats(trades, Number(session.initialBalance));

      const [updated] = await db
        .update(backtestSession)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
          ...stats,
        })
        .where(eq(backtestSession.id, input.sessionId))
        .returning();

      return serializeSession(updated);
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: backtestSession.id })
        .from(backtestSession)
        .where(
          and(
            eq(backtestSession.id, input.sessionId),
            eq(backtestSession.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Soft delete by archiving
      const [updated] = await db
        .update(backtestSession)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(backtestSession.id, input.sessionId))
        .returning();

      return { success: true, id: updated.id };
    }),

  // ============== TRADE CRUD ==============

  addTrade: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        direction: z.enum(["long", "short"]),
        entryPrice: z.number(),
        entryTime: z.string(), // ISO date
        entryTimeUnix: z.number().int().optional(),
        entryBalance: z.number().optional(),
        sl: z.number().optional(),
        tp: z.number().optional(),
        slPips: z.number().optional(),
        tpPips: z.number().optional(),
        riskPercent: z.number().optional(),
        volume: z.number().positive(),
        pipValue: z.number().optional(),
        fees: z.number().optional(),
        commission: z.number().optional(),
        swap: z.number().optional(),
        entrySpreadPips: z.number().optional(),
        entrySlippagePips: z.number().optional(),
        slippagePrice: z.number().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        entryIndicatorValues: z
          .object({
            rsi: z.number().optional(),
            macd: z.number().optional(),
            macdSignal: z.number().optional(),
            atr: z.number().optional(),
            sma1: z.number().optional(),
            sma2: z.number().optional(),
            ema1: z.number().optional(),
            bbUpper: z.number().optional(),
            bbMiddle: z.number().optional(),
            bbLower: z.number().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select({ id: backtestSession.id, userId: backtestSession.userId })
        .from(backtestSession)
        .where(eq(backtestSession.id, input.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      const [trade] = await db
        .insert(backtestTrade)
        .values({
          sessionId: input.sessionId,
          direction: input.direction,
          entryPrice: String(input.entryPrice),
          entryTime: new Date(input.entryTime),
          entryTimeUnix: input.entryTimeUnix,
          entryBalance: input.entryBalance ? String(input.entryBalance) : undefined,
          sl: input.sl ? String(input.sl) : undefined,
          tp: input.tp ? String(input.tp) : undefined,
          slPips: input.slPips ? String(input.slPips) : undefined,
          tpPips: input.tpPips ? String(input.tpPips) : undefined,
          riskPercent: input.riskPercent ? String(input.riskPercent) : undefined,
          volume: String(input.volume),
          pipValue: input.pipValue ? String(input.pipValue) : undefined,
          fees: input.fees !== undefined ? String(input.fees) : undefined,
          commission: input.commission !== undefined ? String(input.commission) : undefined,
          swap: input.swap !== undefined ? String(input.swap) : undefined,
          entrySpreadPips:
            input.entrySpreadPips !== undefined ? String(input.entrySpreadPips) : undefined,
          entrySlippagePips:
            input.entrySlippagePips !== undefined ? String(input.entrySlippagePips) : undefined,
          slippagePrice:
            input.slippagePrice !== undefined ? String(input.slippagePrice) : undefined,
          notes: input.notes,
          tags: input.tags,
          entryIndicatorValues: input.entryIndicatorValues,
          status: "open",
        })
        .returning();

      return serializeTrade(trade);
    }),

  closeTrade: protectedProcedure
    .input(
      z.object({
        tradeId: z.string(),
        exitPrice: z.number(),
        exitTime: z.string(), // ISO date
        exitTimeUnix: z.number().int().optional(),
        exitType: z.enum(["sl", "tp", "manual", "timeout", "session_end"]),
        pnl: z.number().optional(),
        pnlPercent: z.number().optional(),
        pnlPips: z.number().optional(),
        realizedRR: z.number().optional(),
        mfePips: z.number().optional(),
        maePips: z.number().optional(),
        holdTimeSeconds: z.number().int().optional(),
        swap: z.number().optional(),
        exitSlippagePips: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trade ownership through session
      const [existingTrade] = await db
        .select({
          id: backtestTrade.id,
          sessionId: backtestTrade.sessionId,
          entryTime: backtestTrade.entryTime,
        })
        .from(backtestTrade)
        .where(eq(backtestTrade.id, input.tradeId))
        .limit(1);

      if (!existingTrade) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      // Verify session ownership
      const [session] = await db
        .select({ userId: backtestSession.userId })
        .from(backtestSession)
        .where(eq(backtestSession.id, existingTrade.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      // Determine status from exitType
      let status = "closed";
      if (input.exitType === "sl") status = "stopped";
      if (input.exitType === "tp") status = "target";

      const holdTimeSeconds =
        input.holdTimeSeconds ??
        Math.floor(
          (new Date(input.exitTime).getTime() - existingTrade.entryTime.getTime()) / 1000
        );

      const [updated] = await db
        .update(backtestTrade)
        .set({
          exitPrice: String(input.exitPrice),
          exitTime: new Date(input.exitTime),
          exitTimeUnix: input.exitTimeUnix,
          exitType: input.exitType,
          status,
          pnl: input.pnl !== undefined ? String(input.pnl) : undefined,
          pnlPercent: input.pnlPercent !== undefined ? String(input.pnlPercent) : undefined,
          pnlPips: input.pnlPips !== undefined ? String(input.pnlPips) : undefined,
          realizedRR: input.realizedRR !== undefined ? String(input.realizedRR) : undefined,
          mfePips: input.mfePips !== undefined ? String(input.mfePips) : undefined,
          maePips: input.maePips !== undefined ? String(input.maePips) : undefined,
          holdTimeSeconds,
          swap: input.swap !== undefined ? String(input.swap) : undefined,
          exitSlippagePips:
            input.exitSlippagePips !== undefined ? String(input.exitSlippagePips) : undefined,
        })
        .where(eq(backtestTrade.id, input.tradeId))
        .returning();

      return serializeTrade(updated);
    }),

  updateTrade: protectedProcedure
    .input(
      z.object({
        tradeId: z.string(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        sl: z.number().nullable().optional(),
        tp: z.number().nullable().optional(),
        slPips: z.number().nullable().optional(),
        tpPips: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through session
      const [existingTrade] = await db
        .select({ sessionId: backtestTrade.sessionId })
        .from(backtestTrade)
        .where(eq(backtestTrade.id, input.tradeId))
        .limit(1);

      if (!existingTrade) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      const [session] = await db
        .select({ userId: backtestSession.userId })
        .from(backtestSession)
        .where(eq(backtestSession.id, existingTrade.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const updateValues: Record<string, any> = {};
      if (input.notes !== undefined) updateValues.notes = input.notes;
      if (input.tags !== undefined) updateValues.tags = input.tags;
      if (input.sl !== undefined) updateValues.sl = input.sl === null ? null : String(input.sl);
      if (input.tp !== undefined) updateValues.tp = input.tp === null ? null : String(input.tp);
      if (input.slPips !== undefined) updateValues.slPips = input.slPips === null ? null : String(input.slPips);
      if (input.tpPips !== undefined) updateValues.tpPips = input.tpPips === null ? null : String(input.tpPips);

      const [updated] = await db
        .update(backtestTrade)
        .set(updateValues)
        .where(eq(backtestTrade.id, input.tradeId))
        .returning();

      return serializeTrade(updated);
    }),

  getSessionTrades: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        status: z.enum(["open", "closed", "stopped", "target"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select({ userId: backtestSession.userId })
        .from(backtestSession)
        .where(eq(backtestSession.id, input.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      const filters = [eq(backtestTrade.sessionId, input.sessionId)];
      if (input.status) {
        filters.push(eq(backtestTrade.status, input.status));
      }

      const trades = await db
        .select()
        .from(backtestTrade)
        .where(and(...filters))
        .orderBy(asc(backtestTrade.entryTime));

      return trades.map(serializeTrade);
    }),

  // ============== ANALYTICS ==============

  // ============== OVERVIEW STATS (across all sessions) ==============
  getOverviewStats: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Get sessions — either a single one or all non-archived
      const filters = [eq(backtestSession.userId, ctx.session.user.id)];
      if (input?.sessionId) {
        filters.push(eq(backtestSession.id, input.sessionId));
      } else {
        filters.push(sql`${backtestSession.status} != 'archived'`);
      }

      const allSessions = await db
        .select()
        .from(backtestSession)
        .where(and(...filters))
        .orderBy(desc(backtestSession.updatedAt));

      // Get all trades across selected sessions
      const sessionIds = allSessions.map(s => s.id);
      let allTrades: any[] = [];
      if (sessionIds.length > 0) {
        allTrades = await db
          .select()
          .from(backtestTrade)
          .where(sql`${backtestTrade.sessionId} IN ${sessionIds}`)
          .orderBy(asc(backtestTrade.entryTime));
      }

      const closedTrades = allTrades.filter(t => t.status !== "open");
      const completedSessions = allSessions.filter(s => s.status === "completed");
      const activeSessions = allSessions.filter(s => s.status === "active");

      // Total time invested: sum of (completedAt - createdAt) for completed sessions
      // plus (updatedAt - createdAt) for active ones
      let totalTimeSeconds = 0;
      for (const s of allSessions) {
        const start = s.createdAt.getTime();
        const end = s.completedAt ? s.completedAt.getTime() : s.updatedAt.getTime();
        totalTimeSeconds += Math.max(0, Math.floor((end - start) / 1000));
      }

      // Historical time replayed: sum of (endDate - startDate) for all sessions
      let totalHistoricalSeconds = 0;
      for (const s of allSessions) {
        if (s.startDate && s.endDate) {
          totalHistoricalSeconds += Math.max(0, Math.floor((s.endDate.getTime() - s.startDate.getTime()) / 1000));
        }
      }

      // Aggregate trade stats
      const pnls = closedTrades.map(t => Number(t.pnl || 0));
      const totalPnL = pnls.reduce((sum, p) => sum + p, 0);
      const wins = pnls.filter(p => p > 0);
      const losses = pnls.filter(p => p < 0);
      const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
      const totalWins = wins.reduce((s, p) => s + p, 0);
      const totalLosses = Math.abs(losses.reduce((s, p) => s + p, 0));
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

      // Average RR
      const rrs = closedTrades.filter(t => t.realizedRR !== null).map(t => Number(t.realizedRR));
      const avgRR = rrs.length > 0 ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;

      // By symbol
      const bySymbol: Record<string, { total: number; wins: number; pnl: number }> = {};
      for (const s of allSessions) {
        if (!bySymbol[s.symbol]) bySymbol[s.symbol] = { total: 0, wins: 0, pnl: 0 };
      }
      for (const t of closedTrades) {
        const session = allSessions.find(s => s.id === t.sessionId);
        if (!session) continue;
        const sym = session.symbol;
        if (!bySymbol[sym]) bySymbol[sym] = { total: 0, wins: 0, pnl: 0 };
        bySymbol[sym].total++;
        if (Number(t.pnl || 0) > 0) bySymbol[sym].wins++;
        bySymbol[sym].pnl += Number(t.pnl || 0);
      }

      // Direction stats
      const longTrades = closedTrades.filter(t => t.direction === "long");
      const shortTrades = closedTrades.filter(t => t.direction === "short");

      // Session activity by month (for time invested chart)
      const sessionsByMonth: Record<string, number> = {};
      for (const s of allSessions) {
        const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, "0")}`;
        const start = s.createdAt.getTime();
        const end = s.completedAt ? s.completedAt.getTime() : s.updatedAt.getTime();
        const hours = Math.max(0, (end - start) / 3600000);
        sessionsByMonth[key] = (sessionsByMonth[key] || 0) + hours;
      }

      return {
        totalSessions: allSessions.length,
        completedSessions: completedSessions.length,
        activeSessions: activeSessions.length,
        totalTrades: closedTrades.length,
        totalTimeSeconds,
        totalHistoricalSeconds,
        winRate,
        profitFactor: Math.min(profitFactor, 999),
        totalPnL,
        avgRR,
        wins: wins.length,
        losses: losses.length,
        longCount: longTrades.length,
        shortCount: shortTrades.length,
        bySymbol,
        sessionsByMonth,
      };
    }),

  getSessionAnalytics: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [session] = await db
        .select()
        .from(backtestSession)
        .where(
          and(
            eq(backtestSession.id, input.sessionId),
            eq(backtestSession.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Get all trades (including open ones for current state)
      const allTrades = await db
        .select()
        .from(backtestTrade)
        .where(eq(backtestTrade.sessionId, input.sessionId))
        .orderBy(asc(backtestTrade.entryTime));

      const closedTrades = allTrades.filter((t) => t.status !== "open");
      const openTrades = allTrades.filter((t) => t.status === "open");

      // Calculate stats from closed trades
      const stats = calculateSessionStats(closedTrades, Number(session.initialBalance));

      // Build equity curve data points
      const equityCurve = buildEquityCurve(closedTrades, Number(session.initialBalance));

      // Build drawdown series
      const drawdownSeries = buildDrawdownSeries(equityCurve);

      // RR distribution
      const rrDistribution = closedTrades
        .filter((t) => t.realizedRR !== null)
        .map((t) => Number(t.realizedRR));

      // MFE/MAE arrays for scatter plot
      const mfeMae = closedTrades
        .filter((t) => t.mfePips !== null && t.maePips !== null)
        .map((t) => ({
          mfe: Number(t.mfePips),
          mae: Number(t.maePips),
          pnl: Number(t.pnl || 0),
          direction: t.direction,
        }));

      // Win/loss by hour
      const byHour: Record<number, { wins: number; losses: number }> = {};
      for (const t of closedTrades) {
        const hour = t.entryTime.getUTCHours();
        if (!byHour[hour]) byHour[hour] = { wins: 0, losses: 0 };
        if (Number(t.pnl || 0) > 0) byHour[hour].wins++;
        else byHour[hour].losses++;
      }

      // Win/loss by day of week
      const byDay: Record<number, { wins: number; losses: number }> = {};
      for (const t of closedTrades) {
        const day = t.entryTime.getUTCDay();
        if (!byDay[day]) byDay[day] = { wins: 0, losses: 0 };
        if (Number(t.pnl || 0) > 0) byDay[day].wins++;
        else byDay[day].losses++;
      }

      // Direction stats
      const longTrades = closedTrades.filter((t) => t.direction === "long");
      const shortTrades = closedTrades.filter((t) => t.direction === "short");
      const longWins = longTrades.filter((t) => Number(t.pnl || 0) > 0).length;
      const shortWins = shortTrades.filter((t) => Number(t.pnl || 0) > 0).length;

      return {
        session: {
          id: session.id,
          name: session.name,
          symbol: session.symbol,
          timeframe: session.timeframe,
          status: session.status,
          startDate: session.startDate instanceof Date ? session.startDate.toISOString() : session.startDate,
          endDate: session.endDate instanceof Date ? session.endDate.toISOString() : session.endDate,
          initialBalance: session.initialBalance,
          dataSource: session.dataSource,
          createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt,
          completedAt: session.completedAt instanceof Date ? session.completedAt.toISOString() : session.completedAt,
        },
        stats: {
          ...stats,
          totalTradesNum: closedTrades.length,
          openTradesCount: openTrades.length,
        },
        equityCurve,
        drawdownSeries,
        rrDistribution,
        mfeMae,
        byHour,
        byDay,
        directionStats: {
          long: { total: longTrades.length, wins: longWins, winRate: longTrades.length > 0 ? longWins / longTrades.length : 0 },
          short: { total: shortTrades.length, wins: shortWins, winRate: shortTrades.length > 0 ? shortWins / shortTrades.length : 0 },
        },
        trades: allTrades.map(serializeTrade),
      };
    }),

  // ============== AGGREGATE ANALYTICS (across sessions) ==============

  getAggregateAnalytics: protectedProcedure
    .input(z.object({ sessionId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const filters = [eq(backtestSession.userId, ctx.session.user.id)];
      if (input?.sessionId) {
        filters.push(eq(backtestSession.id, input.sessionId));
      } else {
        filters.push(sql`${backtestSession.status} != 'archived'`);
      }

      const sessions = await db
        .select()
        .from(backtestSession)
        .where(and(...filters));

      const sessionIds = sessions.map((s) => s.id);
      let allTrades: any[] = [];
      if (sessionIds.length > 0) {
        allTrades = await db
          .select()
          .from(backtestTrade)
          .where(sql`${backtestTrade.sessionId} IN ${sessionIds}`)
          .orderBy(asc(backtestTrade.entryTime));
      }

      const closedTrades = allTrades.filter((t: any) => t.status !== "open");

      // Use average initial balance across sessions for equity curve
      const avgInitialBalance =
        sessions.length > 0
          ? sessions.reduce((s, sess) => s + Number(sess.initialBalance), 0) /
            sessions.length
          : 10000;

      const stats = calculateSessionStats(closedTrades, avgInitialBalance);
      const equityCurve = buildEquityCurve(closedTrades, avgInitialBalance);
      const drawdownSeries = buildDrawdownSeries(equityCurve);

      const rrDistribution = closedTrades
        .filter((t: any) => t.realizedRR !== null)
        .map((t: any) => Number(t.realizedRR));

      const mfeMae = closedTrades
        .filter((t: any) => t.mfePips !== null && t.maePips !== null)
        .map((t: any) => ({
          mfe: Number(t.mfePips),
          mae: Number(t.maePips),
          pnl: Number(t.pnl || 0),
          direction: t.direction,
        }));

      const byHour: Record<number, { wins: number; losses: number }> = {};
      for (const t of closedTrades) {
        const hour = t.entryTime.getUTCHours();
        if (!byHour[hour]) byHour[hour] = { wins: 0, losses: 0 };
        if (Number(t.pnl || 0) > 0) byHour[hour].wins++;
        else byHour[hour].losses++;
      }

      const byDay: Record<number, { wins: number; losses: number }> = {};
      for (const t of closedTrades) {
        const day = t.entryTime.getUTCDay();
        if (!byDay[day]) byDay[day] = { wins: 0, losses: 0 };
        if (Number(t.pnl || 0) > 0) byDay[day].wins++;
        else byDay[day].losses++;
      }

      const longTrades = closedTrades.filter((t: any) => t.direction === "long");
      const shortTrades = closedTrades.filter((t: any) => t.direction === "short");
      const longWins = longTrades.filter((t: any) => Number(t.pnl || 0) > 0).length;
      const shortWins = shortTrades.filter((t: any) => Number(t.pnl || 0) > 0).length;

      return {
        stats: {
          ...stats,
          totalTradesNum: closedTrades.length,
        },
        equityCurve,
        drawdownSeries,
        rrDistribution,
        mfeMae,
        byHour,
        byDay,
        directionStats: {
          long: { total: longTrades.length, wins: longWins, winRate: longTrades.length > 0 ? longWins / longTrades.length : 0 },
          short: { total: shortTrades.length, wins: shortWins, winRate: shortTrades.length > 0 ? shortWins / shortTrades.length : 0 },
        },
        trades: closedTrades.map(serializeTrade),
      };
    }),

  getRulebookCoaching: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        ruleSetId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select({
          id: backtestSession.id,
          userId: backtestSession.userId,
          symbol: backtestSession.symbol,
          linkedRuleSetId: backtestSession.linkedRuleSetId,
        })
        .from(backtestSession)
        .where(
          and(
            eq(backtestSession.id, input.sessionId),
            eq(backtestSession.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      const ruleSetId = input.ruleSetId ?? session.linkedRuleSetId ?? null;
      if (!ruleSetId) {
        return {
          ruleSet: null,
          summary: null,
          evaluations: [],
        };
      }

      const ruleSet = await assertOwnedRuleSet(ctx.session.user.id, ruleSetId);
      if (!ruleSet) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule set not found" });
      }
      const rules = (ruleSet.rules ?? {}) as ComplianceRules & {
        allowedSessions?: string[];
        allowedDays?: number[];
        allowedSymbols?: string[];
        blockedSymbols?: string[];
        maxPositionSizePercent?: number;
      };

      const trades = await db
        .select()
        .from(backtestTrade)
        .where(eq(backtestTrade.sessionId, input.sessionId))
        .orderBy(asc(backtestTrade.entryTime));

      const totalRulesChecked = Object.keys(rules).filter(
        (key) => (rules as Record<string, unknown>)[key] !== undefined
      ).length;

      const evaluations = trades.map((trade) => {
        const sessionTag = extractBacktestTag(trade.tags, "session:") ?? deriveBacktestSessionTag(trade.entryTime);
        const modelTag = extractBacktestTag(trade.tags, "model:");
        const baseResult = evaluateCompliance(
          {
            sl: numberOrNull(trade.sl),
            tp: numberOrNull(trade.tp),
            sessionTag,
            modelTag,
            entrySpreadPips: numberOrNull(trade.entrySpreadPips),
            entrySlippagePips: numberOrNull(trade.entrySlippagePips),
            exitSlippagePips: numberOrNull(trade.exitSlippagePips),
            plannedRiskPips: numberOrNull(trade.slPips),
            plannedRR:
              numberOrNull(trade.slPips) && numberOrNull(trade.tpPips)
                ? Number(numberOrNull(trade.tpPips)) / Math.max(Number(numberOrNull(trade.slPips)), 0.0001)
                : null,
            maePips: numberOrNull(trade.maePips),
            scaleInCount: 0,
            scaleOutCount: 0,
            partialCloseCount: 0,
            holdSeconds: trade.holdTimeSeconds,
          },
          rules
        );

        const violations = [...baseResult.flags];

        if (rules.allowedSessions?.length && !rules.allowedSessions.includes(sessionTag)) {
          violations.push(`Session not allowed (${sessionTag})`);
        }

        if (rules.allowedDays?.length) {
          const entryDay = trade.entryTime.getUTCDay();
          if (!rules.allowedDays.includes(entryDay)) {
            violations.push(`Day not allowed (${entryDay})`);
          }
        }

        if (rules.allowedSymbols?.length) {
          const allowed = rules.allowedSymbols.some((value) =>
            session.symbol.toUpperCase().includes(value.toUpperCase())
          );
          if (!allowed) {
            violations.push(`Symbol not allowed (${session.symbol})`);
          }
        }

        if (rules.blockedSymbols?.length) {
          const blocked = rules.blockedSymbols.some((value) =>
            session.symbol.toUpperCase().includes(value.toUpperCase())
          );
          if (blocked) {
            violations.push(`Symbol blocked (${session.symbol})`);
          }
        }

        if (rules.maxPositionSizePercent != null) {
          const riskPercent = numberOrNull(trade.riskPercent);
          if (riskPercent != null && riskPercent > rules.maxPositionSizePercent) {
            violations.push("Position size exceeded rulebook cap");
          }
        }

        const uniqueViolations = [...new Set(violations)];
        const failedRulesCount = uniqueViolations.length;
        const passedRulesCount = Math.max(0, totalRulesChecked - failedRulesCount);
        const score =
          totalRulesChecked > 0
            ? Math.max(0, Math.round((passedRulesCount / totalRulesChecked) * 100))
            : 100;
        const status =
          uniqueViolations.length === 0
            ? "pass"
            : score >= 50
            ? "partial"
            : "fail";

        return {
          tradeId: trade.id,
          entryTimeUnix:
            trade.entryTimeUnix ?? Math.floor(trade.entryTime.getTime() / 1000),
          status,
          score,
          sessionTag,
          modelTag,
          violations: uniqueViolations,
          pnl: numberOrNull(trade.pnl),
          realizedRR: numberOrNull(trade.realizedRR),
        };
      });

      const topViolationCounts = new Map<string, number>();
      evaluations.forEach((evaluation) => {
        evaluation.violations.forEach((violation) => {
          topViolationCounts.set(violation, (topViolationCounts.get(violation) ?? 0) + 1);
        });
      });

      const passCount = evaluations.filter((item) => item.status === "pass").length;
      const partialCount = evaluations.filter((item) => item.status === "partial").length;
      const failCount = evaluations.filter((item) => item.status === "fail").length;
      const averageScore =
        evaluations.length > 0
          ? evaluations.reduce((sum, item) => sum + item.score, 0) / evaluations.length
          : 0;

      return {
        ruleSet: {
          id: ruleSet.id,
          name: ruleSet.name,
          description: ruleSet.description,
        },
        summary: {
          totalTrades: evaluations.length,
          passCount,
          partialCount,
          failCount,
          complianceRate:
            evaluations.length > 0 ? Math.round((passCount / evaluations.length) * 100) : 0,
          averageScore: Math.round(averageScore),
          topViolations: [...topViolationCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([violation, count]) => ({ violation, count })),
        },
        evaluations,
      };
    }),

  // ============== AI BEHAVIORAL COMPARISON ==============

  compareToLive: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        sessionId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return compareBacktestToLive(
        ctx.session.user.id,
        input.accountId,
        input.sessionId
      );
    }),

  // ============== MONTE CARLO SIMULATION ==============

  runSimulation: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        simulations: z.number().int().min(100).max(10000).default(5000),
        tradeCount: z.number().int().min(10).max(500).default(100),
        startingEquity: z.number().positive().default(10000),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get backtest trades to sample from
      const filters = [eq(backtestSession.userId, ctx.session.user.id)];
      if (input.sessionId) {
        filters.push(eq(backtestSession.id, input.sessionId));
      } else {
        filters.push(sql`${backtestSession.status} != 'archived'`);
      }

      const sessions = await db
        .select({ id: backtestSession.id })
        .from(backtestSession)
        .where(and(...filters));

      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No sessions found" });
      }

      const trades = await db
        .select({ pnl: backtestTrade.pnl })
        .from(backtestTrade)
        .where(
          and(
            sql`${backtestTrade.sessionId} IN ${sessionIds}`,
            sql`${backtestTrade.status} != 'open'`,
            sql`${backtestTrade.pnl} IS NOT NULL`
          )
        );

      if (trades.length < 10) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Need at least 10 closed trades for Monte Carlo simulation",
        });
      }

      const returns = trades.map((t) => Number(t.pnl || 0));
      const { simulations, tradeCount, startingEquity } = input;

      // Run Monte Carlo
      const allPaths: number[][] = [];
      const finalEquities: number[] = [];
      const maxDrawdowns: number[] = [];

      for (let sim = 0; sim < simulations; sim++) {
        const path: number[] = [startingEquity];
        let equity = startingEquity;
        let peak = startingEquity;
        let maxDD = 0;

        for (let i = 0; i < tradeCount; i++) {
          const randomReturn = returns[Math.floor(Math.random() * returns.length)];
          equity += randomReturn;
          path.push(equity);
          if (equity > peak) peak = equity;
          const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
          if (dd > maxDD) maxDD = dd;
        }

        allPaths.push(path);
        finalEquities.push(equity);
        maxDrawdowns.push(maxDD);
      }

      // Calculate percentile paths (sampled for efficiency)
      const step = Math.max(1, Math.floor(tradeCount / 50));
      const percentilePaths = { p5: [] as number[], p25: [] as number[], p50: [] as number[], p75: [] as number[], p95: [] as number[] };

      for (let i = 0; i <= tradeCount; i += step) {
        const valuesAtPoint = allPaths.map((p) => p[Math.min(i, p.length - 1)]);
        valuesAtPoint.sort((a, b) => a - b);
        percentilePaths.p5.push(valuesAtPoint[Math.floor(simulations * 0.05)]);
        percentilePaths.p25.push(valuesAtPoint[Math.floor(simulations * 0.25)]);
        percentilePaths.p50.push(valuesAtPoint[Math.floor(simulations * 0.5)]);
        percentilePaths.p75.push(valuesAtPoint[Math.floor(simulations * 0.75)]);
        percentilePaths.p95.push(valuesAtPoint[Math.floor(simulations * 0.95)]);
      }

      finalEquities.sort((a, b) => a - b);
      maxDrawdowns.sort((a, b) => a - b);

      const profitableCount = finalEquities.filter((e) => e > startingEquity).length;
      const doubleCount = finalEquities.filter((e) => e >= startingEquity * 2).length;
      const dd10Count = maxDrawdowns.filter((d) => d > 10).length;
      const dd20Count = maxDrawdowns.filter((d) => d > 20).length;
      const dd50Count = maxDrawdowns.filter((d) => d > 50).length;

      // Kelly Criterion from backtest data
      const wins = returns.filter((r) => r > 0);
      const losses = returns.filter((r) => r < 0);
      const winRate = wins.length / returns.length;
      const avgWin = wins.length > 0 ? wins.reduce((s, w) => s + w, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, l) => s + l, 0) / losses.length) : 1;
      const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 1;
      const kelly = Math.max(0, (payoffRatio * winRate - (1 - winRate)) / payoffRatio);

      return {
        simulations,
        tradeCount,
        percentiles: percentilePaths,
        finalEquity: {
          p5: finalEquities[Math.floor(simulations * 0.05)],
          p25: finalEquities[Math.floor(simulations * 0.25)],
          p50: finalEquities[Math.floor(simulations * 0.5)],
          p75: finalEquities[Math.floor(simulations * 0.75)],
          p95: finalEquities[Math.floor(simulations * 0.95)],
          mean: finalEquities.reduce((s, v) => s + v, 0) / finalEquities.length,
        },
        maxDrawdown: {
          p5: maxDrawdowns[Math.floor(simulations * 0.95)],
          p50: maxDrawdowns[Math.floor(simulations * 0.5)],
          p95: maxDrawdowns[Math.floor(simulations * 0.05)],
        },
        probabilities: {
          profitableAfter: (profitableCount / simulations) * 100,
          doubleAccount: (doubleCount / simulations) * 100,
          drawdownExceeds10: (dd10Count / simulations) * 100,
          drawdownExceeds20: (dd20Count / simulations) * 100,
          drawdownExceeds50: (dd50Count / simulations) * 100,
        },
        kellyCriterion: Math.round(kelly * 10000) / 100,
        halfKelly: Math.round((kelly / 2) * 10000) / 100,
      };
    }),

  // ============== JOURNAL WRAPPERS ==============

  getJournalEntries: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(journalEntry.userId, ctx.session.user.id),
        eq(journalEntry.entryType, "backtest"),
        eq(journalEntry.isArchived, false),
      ];

      const entries = await db
        .select()
        .from(journalEntry)
        .where(and(...filters))
        .orderBy(desc(journalEntry.createdAt))
        .limit(input?.limit ?? 20)
        .offset(input?.offset ?? 0);

      // If sessionId filter, filter by tag
      let filtered = entries;
      if (input?.sessionId) {
        filtered = entries.filter((e) =>
          (e.tags as string[] | null)?.includes(`backtest:${input.sessionId}`)
        );
      }

      return filtered.map((e) => ({
        ...e,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt,
        journalDate: e.journalDate instanceof Date ? e.journalDate.toISOString() : e.journalDate ?? null,
        aiAnalyzedAt: e.aiAnalyzedAt instanceof Date ? e.aiAnalyzedAt.toISOString() : e.aiAnalyzedAt ?? null,
      }));
    }),

  createJournalEntry: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        title: z.string().min(1).max(500),
        content: z.string().optional(),
        psychology: z
          .object({
            mood: z.number().min(1).max(10),
            confidence: z.number().min(1).max(10),
            energy: z.number().min(1).max(10),
            focus: z.number().min(1).max(10),
            fear: z.number().min(1).max(10),
            greed: z.number().min(1).max(10),
            emotionalState: z.enum(["calm", "anxious", "excited", "frustrated", "neutral", "stressed", "confident"]),
            notes: z.string().optional(),
          })
          .optional(),
        linkedTradeIds: z.array(z.string()).optional(),
        lessonsLearned: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select({ id: backtestSession.id, name: backtestSession.name })
        .from(backtestSession)
        .where(
          and(
            eq(backtestSession.id, input.sessionId),
            eq(backtestSession.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      const [entry] = await db
        .insert(journalEntry)
        .values({
          userId: ctx.session.user.id,
          title: input.title,
          plainTextContent: input.content,
          entryType: "backtest",
          tags: [`backtest:${input.sessionId}`],
          linkedTradeIds: input.linkedTradeIds ?? [],
          psychology: input.psychology,
          lessonsLearned: input.lessonsLearned,
          journalDate: new Date(),
        })
        .returning();

      return {
        ...entry,
        createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
        updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : entry.updatedAt,
        journalDate: entry.journalDate instanceof Date ? entry.journalDate.toISOString() : entry.journalDate ?? null,
      };
    }),

  updateJournalEntry: protectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        title: z.string().min(1).max(500).optional(),
        content: z.string().optional(),
        psychology: z
          .object({
            mood: z.number().min(1).max(10),
            confidence: z.number().min(1).max(10),
            energy: z.number().min(1).max(10),
            focus: z.number().min(1).max(10),
            fear: z.number().min(1).max(10),
            greed: z.number().min(1).max(10),
            emotionalState: z.enum(["calm", "anxious", "excited", "frustrated", "neutral", "stressed", "confident"]),
            notes: z.string().optional(),
          })
          .optional(),
        linkedTradeIds: z.array(z.string()).optional(),
        lessonsLearned: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { entryId, ...updates } = input;

      const [existing] = await db
        .select({ id: journalEntry.id })
        .from(journalEntry)
        .where(
          and(
            eq(journalEntry.id, entryId),
            eq(journalEntry.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }

      const updateValues: Record<string, any> = { updatedAt: new Date() };
      if (updates.title !== undefined) updateValues.title = updates.title;
      if (updates.content !== undefined) updateValues.plainTextContent = updates.content;
      if (updates.psychology !== undefined) updateValues.psychology = updates.psychology;
      if (updates.linkedTradeIds !== undefined) updateValues.linkedTradeIds = updates.linkedTradeIds;
      if (updates.lessonsLearned !== undefined) updateValues.lessonsLearned = updates.lessonsLearned;

      const [updated] = await db
        .update(journalEntry)
        .set(updateValues)
        .where(eq(journalEntry.id, entryId))
        .returning();

      return {
        ...updated,
        createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
        updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt,
        journalDate: updated.journalDate instanceof Date ? updated.journalDate.toISOString() : updated.journalDate ?? null,
      };
    }),

  deleteJournalEntry: protectedProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: journalEntry.id })
        .from(journalEntry)
        .where(
          and(
            eq(journalEntry.id, input.entryId),
            eq(journalEntry.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }

      await db
        .update(journalEntry)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(eq(journalEntry.id, input.entryId));

      return { success: true };
    }),
});

// ============== HELPER FUNCTIONS ==============

interface TradeRow {
  pnl: string | null;
  pnlPercent: string | null;
  pnlPips: string | null;
  realizedRR: string | null;
  holdTimeSeconds: number | null;
  entryTime: Date;
  exitTime: Date | null;
  direction: string;
  mfePips: string | null;
  maePips: string | null;
}

function calculateSessionStats(trades: TradeRow[], initialBalance: number) {
  if (trades.length === 0) {
    return {
      finalBalance: String(initialBalance),
      finalEquity: String(initialBalance),
      totalPnL: "0",
      totalPnLPercent: "0",
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: "0",
      profitFactor: "0",
      maxDrawdown: "0",
      maxDrawdownPercent: "0",
      sharpeRatio: "0",
      averageRR: "0",
      averageWin: "0",
      averageLoss: "0",
      largestWin: "0",
      largestLoss: "0",
      longestWinStreak: 0,
      longestLoseStreak: 0,
      averageHoldTimeSeconds: 0,
    };
  }

  const pnls = trades.map((t) => Number(t.pnl || 0));
  const totalPnL = pnls.reduce((sum, p) => sum + p, 0);
  const finalBalance = initialBalance + totalPnL;

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);

  const totalWins = wins.reduce((sum, p) => sum + p, 0);
  const totalLosses = Math.abs(losses.reduce((sum, p) => sum + p, 0));

  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;

  // Profit factor
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // Max drawdown
  let peak = initialBalance;
  let maxDD = 0;
  let maxDDPercent = 0;
  let runningBalance = initialBalance;
  for (const pnl of pnls) {
    runningBalance += pnl;
    if (runningBalance > peak) peak = runningBalance;
    const dd = peak - runningBalance;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPercent) maxDDPercent = ddPct;
  }

  // Sharpe ratio (annualized, using daily returns approximation)
  const mean = pnls.length > 0 ? pnls.reduce((s, p) => s + p, 0) / pnls.length : 0;
  const variance = pnls.length > 1
    ? pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnls.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

  // Average RR
  const rrs = trades.filter((t) => t.realizedRR !== null).map((t) => Number(t.realizedRR));
  const avgRR = rrs.length > 0 ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;

  // Streaks
  let winStreak = 0, loseStreak = 0, maxWinStreak = 0, maxLoseStreak = 0;
  for (const pnl of pnls) {
    if (pnl > 0) {
      winStreak++;
      loseStreak = 0;
      if (winStreak > maxWinStreak) maxWinStreak = winStreak;
    } else {
      loseStreak++;
      winStreak = 0;
      if (loseStreak > maxLoseStreak) maxLoseStreak = loseStreak;
    }
  }

  // Average hold time
  const holdTimes = trades.filter((t) => t.holdTimeSeconds !== null).map((t) => t.holdTimeSeconds!);
  const avgHoldTime = holdTimes.length > 0
    ? Math.round(holdTimes.reduce((s, h) => s + h, 0) / holdTimes.length)
    : 0;

  return {
    finalBalance: String(finalBalance),
    finalEquity: String(finalBalance),
    totalPnL: String(totalPnL),
    totalPnLPercent: String((totalPnL / initialBalance) * 100),
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: String(trades.length > 0 ? (wins.length / trades.length) * 100 : 0),
    profitFactor: String(Math.min(profitFactor, 999)),
    maxDrawdown: String(maxDD),
    maxDrawdownPercent: String(maxDDPercent * 100),
    sharpeRatio: String(sharpe),
    averageRR: String(avgRR),
    averageWin: String(avgWin),
    averageLoss: String(avgLoss),
    largestWin: String(wins.length > 0 ? Math.max(...wins) : 0),
    largestLoss: String(losses.length > 0 ? Math.min(...losses) : 0),
    longestWinStreak: maxWinStreak,
    longestLoseStreak: maxLoseStreak,
    averageHoldTimeSeconds: avgHoldTime,
  };
}

function buildEquityCurve(
  trades: TradeRow[],
  initialBalance: number
): { time: string; equity: number; tradeIndex: number }[] {
  const curve = [{ time: "", equity: initialBalance, tradeIndex: -1 }];
  let running = initialBalance;

  for (let i = 0; i < trades.length; i++) {
    running += Number(trades[i].pnl || 0);
    curve.push({
      time: trades[i].exitTime?.toISOString() || trades[i].entryTime.toISOString(),
      equity: running,
      tradeIndex: i,
    });
  }

  return curve;
}

function buildDrawdownSeries(
  equityCurve: { time: string; equity: number; tradeIndex: number }[]
): { time: string; drawdown: number; drawdownPercent: number }[] {
  let peak = equityCurve[0]?.equity || 0;
  return equityCurve.map((point) => {
    if (point.equity > peak) peak = point.equity;
    const dd = peak - point.equity;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    return { time: point.time, drawdown: dd, drawdownPercent: ddPct };
  });
}
