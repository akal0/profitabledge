import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc";
import { db } from "../db";
import {
  tradingAccount,
  propAlert,
  propDailySnapshot,
} from "../db/schema/trading";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  detectPropFirm,
  getAllPropFirms,
  getPropFirmById,
  getChallengeRulesForFirm,
} from "../lib/prop-firm-detection";
import {
  checkPropRules,
  saveAlerts,
  createDailySnapshot,
} from "../lib/prop-rule-monitor";

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Prop Firms tRPC Router
 * Handles prop firm management, detection, and challenge tracking
 */

export const propFirmsRouter = router({
  /**
   * Get all active prop firms
   */
  list: protectedProcedure.query(async () => {
    return getAllPropFirms();
  }),

  /**
   * Get prop firm by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getPropFirmById(input.id);
    }),

  /**
   * Get challenge rules for a prop firm
   */
  getChallengeRules: protectedProcedure
    .input(z.object({ propFirmId: z.string() }))
    .query(async ({ input }) => {
      return getChallengeRulesForFirm(input.propFirmId);
    }),

  /**
   * Auto-detect prop firm from broker info
   */
  detectFromBroker: protectedProcedure
    .input(
      z.object({
        broker: z.string().nullable(),
        brokerServer: z.string().nullable(),
      })
    )
    .query(async ({ input }) => {
      return detectPropFirm(input.broker, input.brokerServer);
    }),

  /**
   * Assign prop firm to an account
   */
  assignToAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        propFirmId: z.string(),
        challengeRuleId: z.string(),
        currentPhase: z.number().min(0).max(3),
        phaseStartDate: z.string(), // ISO date string
        manualOverride: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      // Get starting balance and equity
      const startBalance = parseFloat(
        account.liveBalance?.toString() ||
          account.initialBalance?.toString() ||
          "0"
      );
      const startEquity = parseFloat(
        account.liveEquity?.toString() || account.liveBalance?.toString() || "0"
      );

      // Update account with prop firm info
      await db
        .update(tradingAccount)
        .set({
          isPropAccount: true,
          propFirmId: input.propFirmId,
          propChallengeRuleId: input.challengeRuleId,
          propCurrentPhase: input.currentPhase,
          propPhaseStartDate: input.phaseStartDate,
          propPhaseStartBalance: startBalance.toString(),
          propPhaseStartEquity: startEquity.toString(),
          propDailyHighWaterMark: startEquity.toString(),
          propPhaseHighWaterMark: startEquity.toString(),
          propPhaseCurrentProfit: "0",
          propPhaseCurrentProfitPercent: "0",
          propPhaseTradingDays: 0,
          propPhaseStatus: "active",
          propPhaseBestDayProfit: "0",
          propPhaseBestDayProfitPercent: "0",
          propManualOverride: input.manualOverride,
        })
        .where(eq(tradingAccount.id, input.accountId));

      return { success: true };
    }),

  /**
   * Remove prop firm from account
   */
  removeFromAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      await db
        .update(tradingAccount)
        .set({
          isPropAccount: false,
          propFirmId: null,
          propChallengeRuleId: null,
          propCurrentPhase: null,
          propPhaseStartDate: null,
          propPhaseStartBalance: null,
          propPhaseStartEquity: null,
          propDailyHighWaterMark: null,
          propPhaseHighWaterMark: null,
          propPhaseCurrentProfit: null,
          propPhaseCurrentProfitPercent: null,
          propPhaseTradingDays: null,
          propPhaseStatus: null,
          propPhaseBestDayProfit: null,
          propPhaseBestDayProfitPercent: null,
          propManualOverride: true,
          propDetectedFirmId: null,
        })
        .where(eq(tradingAccount.id, input.accountId));

      return { success: true };
    }),

  /**
   * Get prop tracker dashboard data for an account
   */
  getTrackerDashboard: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account || !account.isPropAccount) {
        throw new Error("Account not found or is not a prop account");
      }

      // Get prop firm and challenge rules
      const propFirm = account.propFirmId
        ? await getPropFirmById(account.propFirmId)
        : null;
      const challengeRule = account.propChallengeRuleId
        ? await db.query.propChallengeRule.findFirst({
            where: (propChallengeRule, { eq }) =>
              eq(propChallengeRule.id, account.propChallengeRuleId!),
          })
        : null;

      // Check rules and get current metrics
      const ruleCheck = await checkPropRules(input.accountId);

      // Get recent alerts
      const alerts = await db.query.propAlert.findMany({
        where: eq(propAlert.accountId, input.accountId),
        orderBy: desc(propAlert.createdAt),
        limit: 20,
      });

      // Get daily snapshots for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const snapshots = await db.query.propDailySnapshot.findMany({
        where: and(
          eq(propDailySnapshot.accountId, input.accountId),
          gte(propDailySnapshot.date, thirtyDaysAgo.toISOString().split("T")[0])
        ),
        orderBy: desc(propDailySnapshot.date),
      });

      const phases = (challengeRule?.phases as any[]) || [];
      const currentPhase =
        phases.find((phase: any) => phase.order === account.propCurrentPhase) ||
        phases[0] ||
        null;
      const targetPct = toNumber(currentPhase?.profitTarget);
      const dailyLossLimit = toNumber(currentPhase?.dailyLossLimit);
      const maxLossLimit = toNumber(currentPhase?.maxLoss);
      const targetRemainingPct = Math.max(
        0,
        targetPct - toNumber(ruleCheck.metrics.currentProfitPercent)
      );
      const dailyHeadroomPct = Math.max(
        0,
        dailyLossLimit - toNumber(ruleCheck.metrics.dailyDrawdownPercent)
      );
      const maxHeadroomPct = Math.max(
        0,
        maxLossLimit - toNumber(ruleCheck.metrics.maxDrawdownPercent)
      );
      const minTradingDaysRemaining = Math.max(
        0,
        toNumber(currentPhase?.minTradingDays) -
          toNumber(ruleCheck.metrics.tradingDays)
      );
      const requiredDailyPacePct =
        ruleCheck.metrics.daysRemaining && ruleCheck.metrics.daysRemaining > 0
          ? targetRemainingPct / ruleCheck.metrics.daysRemaining
          : null;
      const headroomFloor = Math.min(
        dailyLossLimit > 0 ? (dailyHeadroomPct / dailyLossLimit) * 100 : 100,
        maxLossLimit > 0 ? (maxHeadroomPct / maxLossLimit) * 100 : 100
      );
      const survivalState =
        ruleCheck.alerts.some((alert) => alert.type === "breach") ||
        headroomFloor <= 0
          ? "critical"
          : headroomFloor <= 20
          ? "fragile"
          : headroomFloor <= 40
          ? "tight"
          : "stable";

      const nextActions: string[] = [];
      if (dailyHeadroomPct <= Math.max(0.5, dailyLossLimit * 0.2)) {
        nextActions.push(
          "Daily loss headroom is tight. Trade smaller or stand down until the reset."
        );
      }
      if (maxHeadroomPct <= Math.max(1, maxLossLimit * 0.2)) {
        nextActions.push(
          "Overall challenge survival is fragile. Protect the account before chasing the target."
        );
      }
      if (minTradingDaysRemaining > 0) {
        nextActions.push(
          `You still need ${minTradingDaysRemaining} trading day(s). Do not force size just to accelerate the clock.`
        );
      }
      if (requiredDailyPacePct && requiredDailyPacePct > 1.5) {
        nextActions.push(
          `Required pace is ${requiredDailyPacePct.toFixed(
            2
          )}% per remaining day. That is aggressive; tighten execution instead of stretching risk.`
        );
      }
      if (nextActions.length === 0) {
        nextActions.push(
          "Risk state is controlled. Keep the same pace and avoid unnecessary size increases."
        );
      }

      return {
        account,
        propFirm,
        challengeRule,
        currentPhase,
        ruleCheck,
        alerts,
        snapshots,
        commandCenter: {
          targetRemainingPct,
          dailyHeadroomPct,
          maxHeadroomPct,
          minTradingDaysRemaining,
          requiredDailyPacePct,
          survivalState,
          nextActions,
        },
      };
    }),

  /**
   * Get alerts for an account
   */
  getAlerts: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().optional().default(50),
        acknowledged: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      const whereConditions = [eq(propAlert.accountId, input.accountId)];

      if (input.acknowledged !== undefined) {
        whereConditions.push(eq(propAlert.acknowledged, input.acknowledged));
      }

      return db.query.propAlert.findMany({
        where: and(...whereConditions),
        orderBy: desc(propAlert.createdAt),
        limit: input.limit,
      });
    }),

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify alert belongs to user's account
      const alert = await db.query.propAlert.findFirst({
        where: eq(propAlert.id, input.alertId),
      });

      if (!alert) {
        throw new Error("Alert not found");
      }

      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, alert.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account) {
        throw new Error("Access denied");
      }

      await db
        .update(propAlert)
        .set({ acknowledged: true })
        .where(eq(propAlert.id, input.alertId));

      return { success: true };
    }),

  /**
   * Update phase (advance to next phase or mark as funded)
   */
  updatePhase: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        newPhase: z.number().min(0).max(3),
        status: z.enum(["active", "passed", "failed", "paused"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account || !account.isPropAccount) {
        throw new Error("Account not found or is not a prop account");
      }

      const now = new Date().toISOString().split("T")[0];
      const currentBalance = parseFloat(account.liveBalance?.toString() || "0");
      const currentEquity = parseFloat(account.liveEquity?.toString() || "0");

      await db
        .update(tradingAccount)
        .set({
          propCurrentPhase: input.newPhase,
          propPhaseStatus: input.status,
          propPhaseStartDate: now,
          propPhaseStartBalance: currentBalance.toString(),
          propPhaseStartEquity: currentEquity.toString(),
          propDailyHighWaterMark: currentEquity.toString(),
          propPhaseHighWaterMark: currentEquity.toString(),
          propPhaseCurrentProfit: "0",
          propPhaseCurrentProfitPercent: "0",
          propPhaseTradingDays: 0,
          propPhaseBestDayProfit: "0",
          propPhaseBestDayProfitPercent: "0",
        })
        .where(eq(tradingAccount.id, input.accountId));

      return { success: true };
    }),

  /**
   * Get daily snapshots for an account
   */
  getDailySnapshots: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().optional().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      return db.query.propDailySnapshot.findMany({
        where: eq(propDailySnapshot.accountId, input.accountId),
        orderBy: desc(propDailySnapshot.date),
        limit: input.limit,
      });
    }),

  /**
   * Calculate pass/fail probability (Monte Carlo simulation)
   */
  calculateProbability: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!account || !account.isPropAccount) {
        throw new Error("Account not found or is not a prop account");
      }

      // Get historical snapshots to calculate avg daily return and std dev
      const snapshots = await db.query.propDailySnapshot.findMany({
        where: eq(propDailySnapshot.accountId, input.accountId),
        orderBy: desc(propDailySnapshot.date),
        limit: 30, // Last 30 days
      });

      if (snapshots.length === 0) {
        return {
          passPercentage: 0,
          daysToTarget: null,
          riskOfFailure: 100,
          message: "Not enough data to calculate probability",
        };
      }

      // Calculate average daily return and standard deviation
      const dailyReturns = snapshots.map((s) =>
        parseFloat(s.dailyProfitPercent?.toString() || "0")
      );
      const avgDailyReturn =
        dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce(
          (sum, r) => sum + Math.pow(r - avgDailyReturn, 2),
          0
        ) / dailyReturns.length;
      const stdDev = Math.sqrt(variance);

      // Get challenge rules
      const challengeRule = await db.query.propChallengeRule.findFirst({
        where: (propChallengeRule, { eq }) =>
          eq(propChallengeRule.id, account.propChallengeRuleId!),
      });

      if (!challengeRule) {
        throw new Error("Challenge rules not found");
      }

      const phases = challengeRule.phases as any[];
      const currentPhase = phases.find(
        (p) => p.order === account.propCurrentPhase
      );

      if (!currentPhase) {
        throw new Error("Current phase not found");
      }

      const profitTarget = currentPhase.profitTarget;
      const dailyLossLimit = currentPhase.dailyLossLimit;
      const maxLoss = currentPhase.maxLoss;
      const timeLimitDays = currentPhase.timeLimitDays || 365;

      const currentProfit = parseFloat(
        account.propPhaseCurrentProfit?.toString() || "0"
      );
      const currentProfitPercent = parseFloat(
        account.propPhaseCurrentProfitPercent?.toString() || "0"
      );

      // Monte Carlo simulation (1000 iterations)
      const simulations = 1000;
      let passCount = 0;
      const daysToTargetSamples: number[] = [];

      for (let i = 0; i < simulations; i++) {
        let profit = currentProfitPercent;
        let maxDrawdown = 0;
        let failed = false;
        let dayCount = 0;

        for (let day = 0; day < timeLimitDays; day++) {
          // Sample from normal distribution
          const dailyReturn =
            avgDailyReturn +
            (stdDev *
              (Math.random() +
                Math.random() +
                Math.random() +
                Math.random() +
                Math.random() +
                Math.random() -
                3)) /
              Math.sqrt(3);

          // Check daily loss breach
          if (
            dailyLossLimit !== null &&
            Math.abs(Math.min(dailyReturn, 0)) > dailyLossLimit
          ) {
            failed = true;
            break;
          }

          profit += dailyReturn;
          maxDrawdown = Math.max(maxDrawdown, -Math.min(profit, 0));

          // Check max loss breach
          if (maxLoss !== null && maxDrawdown > maxLoss) {
            failed = true;
            break;
          }

          // Check profit target
          if (profitTarget !== null && profit >= profitTarget) {
            passCount++;
            daysToTargetSamples.push(day + 1);
            break;
          }

          dayCount++;
        }

        if (dayCount >= timeLimitDays && profit < profitTarget) {
          failed = true;
        }
      }

      const passPercentage = (passCount / simulations) * 100;
      const avgDaysToTarget =
        daysToTargetSamples.length > 0
          ? daysToTargetSamples.reduce((a, b) => a + b, 0) /
            daysToTargetSamples.length
          : null;

      return {
        passPercentage,
        daysToTarget: avgDaysToTarget ? Math.ceil(avgDaysToTarget) : null,
        riskOfFailure: 100 - passPercentage,
        avgDailyReturn,
        stdDev,
        message: `Based on your last ${snapshots.length} days of trading`,
      };
    }),
});
