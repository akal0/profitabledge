import { z } from "zod";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { tradingRuleSet, tradeRuleEvaluation, tradingAccount, trade } from "../db/schema/trading";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { evaluateCompliance, type ComplianceRules } from "../lib/compliance-audits";

const rulesSchema = z.object({
  requireSL: z.boolean().optional(),
  requireTP: z.boolean().optional(),
  requireSessionTag: z.boolean().optional(),
  requireModelTag: z.boolean().optional(),
  requireEdgeId: z.boolean().optional(),
  requiredEdgeId: z.string().min(1).optional(),
  minEdgeReadinessScore: z.number().int().min(0).max(100).optional(),
  warnOutsideTopSessions: z.boolean().optional(),
  warnOutsideTopSymbols: z.boolean().optional(),
  maxEntrySpreadPips: z.number().positive().optional(),
  maxEntrySlippagePips: z.number().positive().optional(),
  maxExitSlippagePips: z.number().positive().optional(),
  maxPlannedRiskPips: z.number().positive().optional(),
  minPlannedRR: z.number().positive().optional(),
  maxPlannedRR: z.number().positive().optional(),
  maxDrawdownPct: z.number().positive().max(100).optional(),
  disallowScaleIn: z.boolean().optional(),
  disallowScaleOut: z.boolean().optional(),
  disallowPartials: z.boolean().optional(),
  minHoldSeconds: z.number().int().positive().optional(),
  maxHoldSeconds: z.number().int().positive().optional(),
  allowedSessions: z.array(z.string()).optional(),
  allowedDays: z.array(z.number().int().min(0).max(6)).optional(),
  allowedSymbols: z.array(z.string()).optional(),
  blockedSymbols: z.array(z.string()).optional(),
  maxDailyTrades: z.number().int().positive().optional(),
  maxConcurrentTrades: z.number().int().positive().optional(),
  maxDailyLossPercent: z.number().positive().max(100).optional(),
  maxPositionSizePercent: z.number().positive().max(100).optional(),
});

export const rulesRouter = router({
  // List rule sets for user
  listRuleSets: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const conditions = [eq(tradingRuleSet.userId, userId)];
      if (input?.accountId) {
        conditions.push(eq(tradingRuleSet.accountId, input.accountId));
      }

      return db
        .select()
        .from(tradingRuleSet)
        .where(and(...conditions))
        .orderBy(desc(tradingRuleSet.createdAt));
    }),

  // Get a single rule set
  getRuleSet: protectedProcedure
    .input(z.object({ ruleSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await db
        .select()
        .from(tradingRuleSet)
        .where(and(eq(tradingRuleSet.id, input.ruleSetId), eq(tradingRuleSet.userId, userId)))
        .limit(1);

      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule set not found" });
      }

      return result[0];
    }),

  // Create a rule set
  createRuleSet: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      rules: rulesSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify account ownership if specified
      if (input.accountId) {
        const account = await db
          .select({ id: tradingAccount.id })
          .from(tradingAccount)
          .where(and(eq(tradingAccount.id, input.accountId), eq(tradingAccount.userId, userId)))
          .limit(1);
        
        if (!account[0]) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
        }
      }

      const [ruleSet] = await db
        .insert(tradingRuleSet)
        .values({
          userId,
          accountId: input.accountId || null,
          name: input.name,
          description: input.description || null,
          rules: input.rules,
        })
        .returning();

      return ruleSet;
    }),

  // Update a rule set
  updateRuleSet: protectedProcedure
    .input(z.object({
      ruleSetId: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      rules: rulesSchema.optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await db
        .select({ id: tradingRuleSet.id })
        .from(tradingRuleSet)
        .where(and(eq(tradingRuleSet.id, input.ruleSetId), eq(tradingRuleSet.userId, userId)))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule set not found" });
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.rules !== undefined) updates.rules = input.rules;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      const [ruleSet] = await db
        .update(tradingRuleSet)
        .set(updates)
        .where(eq(tradingRuleSet.id, input.ruleSetId))
        .returning();

      return ruleSet;
    }),

  // Delete a rule set
  deleteRuleSet: protectedProcedure
    .input(z.object({ ruleSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .delete(tradingRuleSet)
        .where(and(eq(tradingRuleSet.id, input.ruleSetId), eq(tradingRuleSet.userId, userId)));

      return { ok: true };
    }),

  // Evaluate a single trade against a rule set
  evaluateTrade: protectedProcedure
    .input(z.object({
      tradeId: z.string(),
      ruleSetId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get rule set
      const ruleSet = await db
        .select()
        .from(tradingRuleSet)
        .where(and(eq(tradingRuleSet.id, input.ruleSetId), eq(tradingRuleSet.userId, userId)))
        .limit(1);

      if (!ruleSet[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule set not found" });
      }

      // Get trade
      const tradeResult = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          symbol: trade.symbol,
          sl: sql<number | null>`CAST(${trade.sl} AS NUMERIC)`,
          tp: sql<number | null>`CAST(${trade.tp} AS NUMERIC)`,
          sessionTag: trade.sessionTag,
          modelTag: trade.modelTag,
          entrySpreadPips: sql<number | null>`CAST(${trade.entrySpreadPips} AS NUMERIC)`,
          entrySlippagePips: sql<number | null>`CAST(${trade.entrySlippagePips} AS NUMERIC)`,
          exitSlippagePips: sql<number | null>`CAST(${trade.exitSlippagePips} AS NUMERIC)`,
          plannedRiskPips: sql<number | null>`CAST(${trade.plannedRiskPips} AS NUMERIC)`,
          plannedRR: sql<number | null>`CAST(${trade.plannedRR} AS NUMERIC)`,
          maePips: sql<number | null>`CAST(${trade.maePips} AS NUMERIC)`,
          scaleInCount: trade.scaleInCount,
          scaleOutCount: trade.scaleOutCount,
          partialCloseCount: trade.partialCloseCount,
          tradeDurationSeconds: trade.tradeDurationSeconds,
          openTime: trade.openTime,
        })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!tradeResult[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      // Verify ownership
      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, tradeResult[0].accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const t = tradeResult[0];
      const rules = ruleSet[0].rules as ComplianceRules & {
        allowedSessions?: string[];
        allowedDays?: number[];
        allowedSymbols?: string[];
        blockedSymbols?: string[];
      };

      // Use existing compliance evaluator
      const holdSeconds = t.tradeDurationSeconds ? parseInt(t.tradeDurationSeconds, 10) : null;
      const baseResult = evaluateCompliance({
        sl: t.sl,
        tp: t.tp,
        sessionTag: t.sessionTag,
        modelTag: t.modelTag,
        entrySpreadPips: t.entrySpreadPips,
        entrySlippagePips: t.entrySlippagePips,
        exitSlippagePips: t.exitSlippagePips,
        plannedRiskPips: t.plannedRiskPips,
        plannedRR: t.plannedRR,
        maePips: t.maePips,
        scaleInCount: t.scaleInCount,
        scaleOutCount: t.scaleOutCount,
        partialCloseCount: t.partialCloseCount,
        holdSeconds,
      }, rules);

      const violations = [...baseResult.flags];

      // Additional rule checks
      if (rules.allowedSessions && rules.allowedSessions.length > 0) {
        if (!t.sessionTag || !rules.allowedSessions.includes(t.sessionTag)) {
          violations.push(`Session not allowed (got: ${t.sessionTag || 'none'}, allowed: ${rules.allowedSessions.join(', ')})`);
        }
      }

      if (rules.allowedDays && rules.allowedDays.length > 0 && t.openTime) {
        const dayOfWeek = new Date(t.openTime).getDay();
        if (!rules.allowedDays.includes(dayOfWeek)) {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          violations.push(`Day not allowed (got: ${dayNames[dayOfWeek]}, allowed: ${rules.allowedDays.map(d => dayNames[d]).join(', ')})`);
        }
      }

      if (rules.allowedSymbols && rules.allowedSymbols.length > 0) {
        if (!t.symbol || !rules.allowedSymbols.some(s => t.symbol?.toUpperCase().includes(s.toUpperCase()))) {
          violations.push(`Symbol not allowed: ${t.symbol}`);
        }
      }

      if (rules.blockedSymbols && rules.blockedSymbols.length > 0) {
        if (t.symbol && rules.blockedSymbols.some(s => t.symbol?.toUpperCase().includes(s.toUpperCase()))) {
          violations.push(`Symbol is blocked: ${t.symbol}`);
        }
      }

      // Calculate score
      const totalRulesChecked = Object.keys(rules).filter(k => (rules as any)[k] !== undefined).length;
      const failedRulesCount = violations.length;
      const passedRulesCount = Math.max(0, totalRulesChecked - failedRulesCount);
      const score = totalRulesChecked > 0 ? Math.round((passedRulesCount / totalRulesChecked) * 100) : 100;
      const status = violations.length === 0 ? "pass" : score >= 50 ? "partial" : "fail";

      // Save evaluation
      const [evaluation] = await db
        .insert(tradeRuleEvaluation)
        .values({
          tradeId: input.tradeId,
          ruleSetId: input.ruleSetId,
          status,
          score: score.toString(),
          passedRules: passedRulesCount,
          failedRules: failedRulesCount,
          totalRules: totalRulesChecked,
          violations,
        })
        .returning();

      return {
        evaluation,
        score,
        status,
        violations,
        passedRules: passedRulesCount,
        failedRules: failedRulesCount,
        totalRules: totalRulesChecked,
      };
    }),

  // Get evaluations for a trade
  getTradeEvaluations: protectedProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify trade ownership
      const tradeResult = await db
        .select({ accountId: trade.accountId })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!tradeResult[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, tradeResult[0].accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      return db
        .select()
        .from(tradeRuleEvaluation)
        .where(eq(tradeRuleEvaluation.tradeId, input.tradeId))
        .orderBy(desc(tradeRuleEvaluation.evaluatedAt));
    }),

  // Get compliance summary for an account
  getAccountComplianceSummary: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      ruleSetId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify account ownership
      const account = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(and(eq(tradingAccount.id, input.accountId), eq(tradingAccount.userId, userId)))
        .limit(1);

      if (!account[0]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
      }

      // Get all evaluations for trades in this account
      const conditions = [eq(trade.accountId, input.accountId)];
      if (input.ruleSetId) {
        // Additional filter would go here but needs join
      }

      const evaluations = await db
        .select({
          status: tradeRuleEvaluation.status,
          score: tradeRuleEvaluation.score,
          violations: tradeRuleEvaluation.violations,
        })
        .from(tradeRuleEvaluation)
        .innerJoin(trade, eq(tradeRuleEvaluation.tradeId, trade.id))
        .where(eq(trade.accountId, input.accountId));

      const totalEvaluations = evaluations.length;
      const passCount = evaluations.filter(e => e.status === "pass").length;
      const partialCount = evaluations.filter(e => e.status === "partial").length;
      const failCount = evaluations.filter(e => e.status === "fail").length;
      
      const avgScore = totalEvaluations > 0
        ? evaluations.reduce((sum, e) => sum + parseFloat(e.score || "0"), 0) / totalEvaluations
        : 0;

      // Count most common violations
      const violationCounts: Record<string, number> = {};
      for (const e of evaluations) {
        const violations = e.violations as string[] | null;
        if (violations) {
          for (const v of violations) {
            violationCounts[v] = (violationCounts[v] || 0) + 1;
          }
        }
      }

      const topViolations = Object.entries(violationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([violation, count]) => ({ violation, count }));

      return {
        totalEvaluations,
        passCount,
        partialCount,
        failCount,
        passRate: totalEvaluations > 0 ? Math.round((passCount / totalEvaluations) * 100) : 0,
        avgScore: Math.round(avgScore),
        topViolations,
      };
    }),

  /**
   * Rule Impact Analysis
   * Compare P&L of compliant vs non-compliant trades to show rule value
   */
  ruleImpact: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      // Get all evaluations with trade P&L
      const evals = await db
        .select({
          tradeId: tradeRuleEvaluation.tradeId,
          status: tradeRuleEvaluation.status,
          passedRules: tradeRuleEvaluation.passedRules,
          failedRules: tradeRuleEvaluation.failedRules,
          totalRules: tradeRuleEvaluation.totalRules,
          pnl: trade.profit,
          rr: trade.realisedRR,
        })
        .from(tradeRuleEvaluation)
        .innerJoin(trade, eq(trade.id, tradeRuleEvaluation.tradeId))
        .innerJoin(tradingRuleSet, eq(tradingRuleSet.id, tradeRuleEvaluation.ruleSetId))
        .where(eq(tradingRuleSet.userId, userId));

      const compliant = evals.filter((e) => e.status === "pass");
      const nonCompliant = evals.filter((e) => e.status === "fail");

      const calcStats = (group: typeof evals) => {
        if (group.length === 0) return { count: 0, avgPnl: 0, winRate: 0, avgRR: 0, totalPnl: 0 };
        const pnls = group.map((e) => parseFloat(e.pnl?.toString() || "0"));
        const rrs = group.map((e) => parseFloat(e.rr?.toString() || "0")).filter((r) => r !== 0);
        const wins = pnls.filter((p) => p > 0).length;
        return {
          count: group.length,
          avgPnl: pnls.reduce((s, p) => s + p, 0) / group.length,
          winRate: (wins / group.length) * 100,
          avgRR: rrs.length > 0 ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0,
          totalPnl: pnls.reduce((s, p) => s + p, 0),
        };
      };

      return {
        compliant: calcStats(compliant),
        nonCompliant: calcStats(nonCompliant),
        totalEvaluated: evals.length,
        complianceRate: evals.length > 0 ? (compliant.length / evals.length) * 100 : 0,
        rulesPayoff: calcStats(compliant).avgPnl - calcStats(nonCompliant).avgPnl,
      };
    }),

  /**
   * Conditional/Dynamic Rules: evaluate rule modifications based on trading behavior
   * Suggests automatic rule adjustments when certain triggers are met
   */
  getConditionalRuleStatus: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get recent trades (last 30 days)
      const since = new Date(Date.now() - 30 * 86400000);
      const recentTrades = await db
        .select()
        .from(trade)
        .where(and(eq(trade.accountId, input.accountId)))
        .orderBy(desc(trade.createdAt))
        .limit(200);

      const pnls = recentTrades.map((t) => parseFloat(t.profit?.toString() || "0"));

      // Detect consecutive loss streaks
      let currentStreak = 0;
      let maxStreak = 0;
      for (const pnl of pnls) {
        if (pnl < 0) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      // Daily P&L aggregation
      const dailyPnls: Record<string, number> = {};
      for (const t of recentTrades) {
        const day = new Date(t.createdAt).toISOString().slice(0, 10);
        dailyPnls[day] = (dailyPnls[day] || 0) + parseFloat(t.profit?.toString() || "0");
      }
      const dailyValues = Object.values(dailyPnls);
      const worstDay = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;

      // Win streak detection
      let winStreak = 0;
      for (const pnl of pnls) {
        if (pnl > 0) winStreak++;
        else break;
      }

      // Position sizing trend after losses
      const volumes = recentTrades.map((t) => parseFloat(t.volume?.toString() || "0"));
      let sizeIncreaseAfterLoss = false;
      for (let i = 1; i < Math.min(pnls.length, 10); i++) {
        if (pnls[i - 1] < 0 && volumes[i] > volumes[i - 1] * 1.3) {
          sizeIncreaseAfterLoss = true;
          break;
        }
      }

      // Build conditional rule recommendations
      const rules: Array<{
        id: string;
        trigger: string;
        action: string;
        severity: "info" | "warning" | "critical";
        active: boolean;
        description: string;
      }> = [];

      // After 2 consecutive losses → reduce size
      rules.push({
        id: "reduce_after_2_losses",
        trigger: `${currentStreak >= 2 ? "ACTIVE" : "Inactive"}: ${currentStreak} consecutive losses`,
        action: "Reduce position size by 30%",
        severity: currentStreak >= 2 ? "warning" : "info",
        active: currentStreak >= 2,
        description: "When 2+ consecutive losses detected, recommend reducing position size to limit damage",
      });

      // After 3 consecutive losses → reduce more
      rules.push({
        id: "reduce_after_3_losses",
        trigger: `${currentStreak >= 3 ? "ACTIVE" : "Inactive"}: ${currentStreak} consecutive losses`,
        action: "Reduce position size by 50% and take 30-min break",
        severity: currentStreak >= 3 ? "critical" : "info",
        active: currentStreak >= 3,
        description: "When 3+ consecutive losses, aggressively reduce risk and force cooldown",
      });

      // Daily loss exceeds 2% → block
      rules.push({
        id: "block_on_daily_loss",
        trigger: `Worst daily loss: $${Math.abs(worstDay).toFixed(0)}`,
        action: "Block all trades for rest of day",
        severity: worstDay < -200 ? "warning" : "info",
        active: false, // Would be active in real-time
        description: "If daily loss exceeds configured threshold, prevent further trading",
      });

      // Win streak > 5 → overconfidence guard
      rules.push({
        id: "overconfidence_guard",
        trigger: `${winStreak >= 5 ? "ACTIVE" : "Inactive"}: ${winStreak} win streak`,
        action: "Reduce max position size by 30%",
        severity: winStreak >= 5 ? "warning" : "info",
        active: winStreak >= 5,
        description: "Extended win streaks can lead to overconfidence. Automatically limit risk.",
      });

      // Revenge trading detection
      rules.push({
        id: "revenge_trading_guard",
        trigger: sizeIncreaseAfterLoss ? "DETECTED: Size increase after loss" : "No revenge trading detected",
        action: "Alert and cap position size to pre-loss level",
        severity: sizeIncreaseAfterLoss ? "critical" : "info",
        active: sizeIncreaseAfterLoss,
        description: "Position size increases after losses suggest revenge trading behavior",
      });

      const activeCount = rules.filter((r) => r.active).length;

      return {
        rules,
        activeRules: activeCount,
        currentLossStreak: currentStreak,
        maxLossStreak: maxStreak,
        currentWinStreak: winStreak,
        sizeIncreaseAfterLoss,
        worstDailyLoss: worstDay,
        tradesAnalyzed: recentTrades.length,
      };
    }),
});
