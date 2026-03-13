import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc";
import { db } from "../db";
import {
  tradingAccount,
  propAlert,
  propDailySnapshot,
  propChallengeInstance,
  propChallengeRule,
  propFirm,
  trade,
} from "../db/schema/trading";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  detectPropFirm,
  getAccessiblePropFirms,
  getChallengeRuleById,
  getPropFirmById,
  getChallengeRulesForFirm,
  resolvePropTrackingSeed,
} from "../lib/prop-firm-detection";
import { checkPropRules, syncPropAccountState } from "../lib/prop-rule-monitor";
import {
  attachAccountToPropChallenge,
  ensurePropChallengeLineageForAccount,
  getPropChallengeLineageForAccount,
  listContinuablePropChallenges,
  pausePropChallengeForAccount,
  recordPropChallengePhaseAdvance,
  syncPropChallengeOutcomeForAccount,
} from "../lib/prop-challenge-lineage";

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], mean = average(values)) {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

function gaussianishSample() {
  return (
    (Math.random() +
      Math.random() +
      Math.random() +
      Math.random() +
      Math.random() +
      Math.random() -
      3) /
    Math.sqrt(3)
  );
}

function sampleOne<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)]!;
}

function dayDiffInclusive(start: Date, end: Date) {
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((+endDay - +startDay) / 86400000) + 1);
}

function getProbabilityMetricMode(
  phase: Record<string, any> | null | undefined
): "currency" | "percent" {
  return phase?.profitTargetType === "absolute" ? "currency" : "percent";
}

function getMaxDrawdownValueFromPeak(
  mode: "currency" | "percent",
  maxLossType: "trailing" | "absolute" | null | undefined,
  currentProfit: number,
  peakProfit: number,
  phaseStartBalance: number
) {
  if (mode === "currency") {
    return Math.max(0, peakProfit - currentProfit);
  }

  if (maxLossType === "trailing") {
    const peakEquity = phaseStartBalance * (1 + peakProfit / 100);
    const currentEquity = phaseStartBalance * (1 + currentProfit / 100);
    if (peakEquity <= 0) return 0;
    return Math.max(0, ((peakEquity - currentEquity) / peakEquity) * 100);
  }

  return Math.max(0, peakProfit - currentProfit);
}

function getCurrentPeakProfitValue(
  mode: "currency" | "percent",
  maxLossType: "trailing" | "absolute" | null | undefined,
  currentProfit: number,
  currentDrawdown: number
) {
  if (mode === "currency") {
    return currentProfit + currentDrawdown;
  }

  if (maxLossType === "trailing") {
    const currentEquityMultiple = 1 + currentProfit / 100;
    const remainingFraction = 1 - currentDrawdown / 100;

    if (remainingFraction <= 0) {
      return currentProfit + currentDrawdown;
    }

    return (currentEquityMultiple / remainingFraction - 1) * 100;
  }

  return currentProfit + currentDrawdown;
}

const customChallengePhaseSchema = z.object({
  profitTarget: z.number().positive(),
  dailyLossLimit: z.number().positive(),
  maxLoss: z.number().positive(),
  timeLimitDays: z.number().int().positive().nullable().default(null),
  minTradingDays: z.number().int().min(0).default(0),
});

const customFundedPhaseSchema = z.object({
  dailyLossLimit: z.number().positive(),
  maxLoss: z.number().positive(),
  timeLimitDays: z.number().int().positive().nullable().default(null),
  minTradingDays: z.number().int().min(0).default(0),
});

/**
 * Prop Firms tRPC Router
 * Handles prop firm management, detection, and challenge tracking
 */

export const propFirmsRouter = router({
  /**
   * Get all active prop firms
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getAccessiblePropFirms(ctx.session.user.id);
  }),

  /**
   * Get prop firm by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return getPropFirmById(input.id, ctx.session.user.id);
    }),

  /**
   * Get challenge rules for a prop firm
   */
  getChallengeRules: protectedProcedure
    .input(z.object({ propFirmId: z.string() }))
    .query(async ({ input, ctx }) => {
      return getChallengeRulesForFirm(input.propFirmId, ctx.session.user.id);
    }),

  createCustomFlow: protectedProcedure
    .input(
      z.object({
        propFirmName: z.string().trim().min(2).max(80),
        challengeDisplayName: z.string().trim().min(2).max(120).optional(),
        description: z.string().trim().max(240).optional(),
        challengePhases: z.array(customChallengePhaseSchema).min(1).max(8),
        fundedPhase: customFundedPhaseSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const propFirmName = input.propFirmName.trim();
      const challengeDisplayName =
        input.challengeDisplayName?.trim() || `${propFirmName} Custom Flow`;
      const firmDescription =
        input.description?.trim() || "Custom user-defined prop challenge flow.";
      const now = new Date();

      const phases = [
        ...input.challengePhases.map((phase, index) => ({
          order: index + 1,
          name: `Phase ${index + 1}`,
          profitTarget: phase.profitTarget,
          profitTargetType: "percentage" as const,
          dailyLossLimit: phase.dailyLossLimit,
          maxLoss: phase.maxLoss,
          maxLossType: "absolute" as const,
          timeLimitDays: phase.timeLimitDays ?? null,
          minTradingDays: phase.minTradingDays,
          consistencyRule: null,
          customRules: {
            isCustom: true,
          },
        })),
        {
          order: 0,
          name: "Funded",
          profitTarget: null,
          profitTargetType: "percentage" as const,
          dailyLossLimit: input.fundedPhase.dailyLossLimit,
          maxLoss: input.fundedPhase.maxLoss,
          maxLossType: "absolute" as const,
          timeLimitDays: input.fundedPhase.timeLimitDays ?? null,
          minTradingDays: input.fundedPhase.minTradingDays,
          consistencyRule: null,
          customRules: {
            isCustom: true,
            funded: true,
          },
        },
      ];

      const [createdFirm] = await db
        .insert(propFirm)
        .values({
          id: crypto.randomUUID(),
          createdByUserId: ctx.session.user.id,
          name: propFirmName,
          displayName: propFirmName,
          description: firmDescription,
          logo: null,
          website: null,
          supportedPlatforms: ["mt4", "mt5", "ctrader"],
          brokerDetectionPatterns: [],
          active: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!createdFirm) {
        throw new Error("Failed to create prop firm");
      }

      const [createdRule] = await db
        .insert(propChallengeRule)
        .values({
          id: crypto.randomUUID(),
          createdByUserId: ctx.session.user.id,
          propFirmId: createdFirm.id,
          challengeType: "custom",
          displayName: challengeDisplayName,
          phases,
          active: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!createdRule) {
        throw new Error("Failed to create challenge rule");
      }

      return {
        propFirm: createdFirm,
        challengeRule: createdRule,
      };
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
   * List existing challenge instances that can be continued with a new account
   */
  listContinuableChallenges: protectedProcedure.query(async ({ ctx }) => {
    const instances = await listContinuablePropChallenges(ctx.session.user.id);

    return Promise.all(
      instances.map(async (instance) => {
        const [propFirm, challengeRule] = await Promise.all([
          getPropFirmById(instance.propFirmId, ctx.session.user.id),
          getChallengeRuleById(
            instance.propChallengeRuleId,
            ctx.session.user.id
          ),
        ]);
        const phases = (challengeRule?.phases as any[]) || [];
        const currentPhase =
          phases.find((phase: any) => phase.order === instance.currentPhase) ||
          null;

        return {
          ...instance,
          propFirm,
          challengeRule,
          currentPhase,
        };
      })
    );
  }),

  /**
   * Assign prop firm to an account
   */
  assignToAccount: protectedProcedure
    .input(
      z
        .object({
          accountId: z.string(),
          propFirmId: z.string().optional(),
          challengeRuleId: z.string().optional(),
          currentPhase: z.number().int().min(0).max(12).optional(),
          challengeInstanceId: z.string().nullish(),
          phaseStartDate: z.string().optional(), // ISO date string
          manualOverride: z.boolean().default(false),
        })
        .refine(
          (value) =>
            Boolean(value.challengeInstanceId) ||
            Boolean(
              value.propFirmId &&
                value.challengeRuleId &&
                value.currentPhase !== undefined
            ),
          {
            message: "Challenge configuration is required",
            path: ["challengeInstanceId"],
          }
        )
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

      let resolvedPropFirmId = input.propFirmId ?? account.propFirmId;
      let resolvedChallengeRuleId =
        input.challengeRuleId ?? account.propChallengeRuleId;
      let resolvedCurrentPhase = input.currentPhase ?? 1;

      if (input.challengeInstanceId) {
        const challengeInstance =
          await db.query.propChallengeInstance.findFirst({
            where: and(
              eq(propChallengeInstance.id, input.challengeInstanceId),
              eq(propChallengeInstance.userId, ctx.session.user.id)
            ),
          });

        if (!challengeInstance) {
          throw new Error("Challenge not found or access denied");
        }

        resolvedPropFirmId = challengeInstance.propFirmId;
        resolvedChallengeRuleId = challengeInstance.propChallengeRuleId;
        resolvedCurrentPhase = challengeInstance.currentPhase;
      }

      if (!resolvedPropFirmId || !resolvedChallengeRuleId) {
        throw new Error("Challenge configuration is incomplete");
      }

      const { phaseStartDate, startBalance, startEquity } =
        await resolvePropTrackingSeed(
          {
            accountId: account.id,
            broker: account.broker,
            brokerServer: account.brokerServer,
            initialBalance: account.initialBalance,
            liveBalance: account.liveBalance,
            liveEquity: account.liveEquity,
          },
          {
            phaseStartDate: input.phaseStartDate,
          }
        );

      const challengeRule = await getChallengeRuleById(
        resolvedChallengeRuleId,
        ctx.session.user.id
      );
      const resolvedPropFirm = await getPropFirmById(
        resolvedPropFirmId,
        ctx.session.user.id
      );

      if (!resolvedPropFirm || !challengeRule) {
        throw new Error("Challenge configuration not found");
      }
      const phaseLabel =
        ((challengeRule?.phases as any[]) || []).find(
          (phase: any) => phase.order === resolvedCurrentPhase
        )?.name || null;

      const challengeInstance = await attachAccountToPropChallenge({
        userId: ctx.session.user.id,
        accountId: input.accountId,
        propFirmId: resolvedPropFirmId,
        challengeRuleId: resolvedChallengeRuleId,
        currentPhase: resolvedCurrentPhase,
        phaseStartDate,
        startBalance,
        startEquity,
        manualOverride: input.manualOverride,
        challengeInstanceId: input.challengeInstanceId ?? null,
        phaseLabel,
      });

      return {
        success: true,
        challengeInstanceId: challengeInstance.id,
      };
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

      await pausePropChallengeForAccount(input.accountId);

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
          propChallengeInstanceId: null,
          propIsCurrentChallengeStage: true,
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
        ? await getPropFirmById(account.propFirmId, ctx.session.user.id)
        : null;
      const challengeRule = account.propChallengeRuleId
        ? await getChallengeRuleById(
            account.propChallengeRuleId,
            ctx.session.user.id
          )
        : null;

      // Check rules and get current metrics
      const ruleCheck =
        (await syncPropAccountState(input.accountId)) ??
        (await checkPropRules(input.accountId));
      const challengeLineage = await getPropChallengeLineageForAccount(
        input.accountId
      );

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
        effectivePhaseStatus: ruleCheck.phaseStatus,
        challengeLineage,
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
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(20).default(5),
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

      const offset = (input.page - 1) * input.pageSize;
      const whereClause = and(...whereConditions);
      const [items, totalRows] = await Promise.all([
        db.query.propAlert.findMany({
          where: whereClause,
          orderBy: desc(propAlert.createdAt),
          limit: input.pageSize,
          offset,
        }),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(propAlert)
          .where(whereClause),
      ]);

      const totalCount = Number(totalRows[0]?.count ?? 0);

      return {
        items,
        totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / input.pageSize)),
      };
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
        newPhase: z.number().int().min(0).max(12),
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
      const previousPhase = account.propCurrentPhase ?? input.newPhase;

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

      if (input.newPhase !== previousPhase) {
        await recordPropChallengePhaseAdvance({
          accountId: input.accountId,
          previousPhase,
          nextPhase: input.newPhase,
          phaseStartedAt: now,
          startBalance: currentBalance,
          startEquity: currentEquity,
        });
      }

      await ensurePropChallengeLineageForAccount(input.accountId);
      await syncPropChallengeOutcomeForAccount({
        accountId: input.accountId,
        phaseStatus: input.status,
      });

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

      const ruleCheck =
        (await syncPropAccountState(input.accountId)) ??
        (await checkPropRules(input.accountId));

      if (account.propCurrentPhase === 0) {
        return {
          passPercentage: 100,
          daysToTarget: 0,
          riskOfFailure: 0,
          avgDailyReturn: 0,
          stdDev: 0,
          message: "This account has already reached funded status.",
        };
      }

      if (ruleCheck.phaseStatus === "failed") {
        return {
          passPercentage: 0,
          daysToTarget: null,
          riskOfFailure: 100,
          avgDailyReturn: 0,
          stdDev: 0,
          message:
            "This phase has already failed due to the current rule state.",
        };
      }

      // Get challenge rules
      const challengeRule = await getChallengeRuleById(
        account.propChallengeRuleId!,
        ctx.session.user.id
      );

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

      const metricMode = getProbabilityMetricMode(currentPhase);
      const phaseStartDate = account.propPhaseStartDate
        ? new Date(`${account.propPhaseStartDate}T00:00:00.000Z`)
        : null;
      const phaseStartDayKey = phaseStartDate
        ? phaseStartDate.toISOString().split("T")[0]
        : null;
      const snapshots = await db.query.propDailySnapshot.findMany({
        where: phaseStartDayKey
          ? and(
              eq(propDailySnapshot.accountId, input.accountId),
              gte(propDailySnapshot.date, phaseStartDayKey)
            )
          : eq(propDailySnapshot.accountId, input.accountId),
        orderBy: desc(propDailySnapshot.date),
        limit: 90,
      });

      const tradingDaySnapshots = snapshots.filter(
        (snapshot) =>
          Boolean(snapshot.isTradingDay) ||
          Math.abs(
            toNumber(
              metricMode === "currency"
                ? snapshot.dailyProfit
                : snapshot.dailyProfitPercent
            )
          ) > 0.0001
      );
      const sampledSnapshots =
        tradingDaySnapshots.length > 0 ? tradingDaySnapshots : snapshots;
      let dailyReturns = sampledSnapshots
        .map((snapshot) =>
          toNumber(
            metricMode === "currency"
              ? snapshot.dailyProfit
              : snapshot.dailyProfitPercent
          )
        )
        .filter((value) => Number.isFinite(value));

      let observedTradingDays = tradingDaySnapshots.length;
      const observedCalendarDays = phaseStartDate
        ? dayDiffInclusive(phaseStartDate, new Date())
        : Math.max(1, snapshots.length);

      if (dailyReturns.length < 3 && phaseStartDate) {
        const tradeDayRows = await db
          .select({
            day: sql<string>`DATE(${trade.closeTime})`,
            pnl: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC) + COALESCE(CAST(${trade.commissions} AS NUMERIC),0) + COALESCE(CAST(${trade.swap} AS NUMERIC),0)),0)`,
          })
          .from(trade)
          .where(
            and(
              eq(trade.accountId, input.accountId),
              gte(trade.closeTime, phaseStartDate)
            )
          )
          .groupBy(sql`DATE(${trade.closeTime})`)
          .orderBy(sql`DATE(${trade.closeTime})`)
          .limit(90);

        if (tradeDayRows.length > 0) {
          let runningBalance = Math.max(
            1,
            toNumber(account.propPhaseStartBalance ?? account.initialBalance)
          );

          dailyReturns = tradeDayRows
            .map((row) => {
              const dailyPnl = toNumber(row.pnl);
              const dailyReturn =
                metricMode === "currency"
                  ? dailyPnl
                  : runningBalance > 0
                  ? (dailyPnl / runningBalance) * 100
                  : 0;
              runningBalance += dailyPnl;
              return dailyReturn;
            })
            .filter((value) => Number.isFinite(value));
          observedTradingDays = tradeDayRows.length;
        }
      }

      if (dailyReturns.length === 0) {
        return {
          passPercentage: 0,
          daysToTarget: null,
          avgDailyReturn: 0,
          stdDev: 0,
          riskOfFailure: 100,
          message: "Not enough phase trade data to calculate probability",
        };
      }

      const avgDailyReturn = average(dailyReturns);
      const rawStdDev = standardDeviation(dailyReturns, avgDailyReturn);
      const sampleConfidence = Math.min(1, dailyReturns.length / 20);
      const currentResult =
        metricMode === "currency"
          ? toNumber(ruleCheck.metrics.currentProfit)
          : toNumber(ruleCheck.metrics.currentProfitPercent);
      const currentDrawdown =
        metricMode === "currency"
          ? toNumber(ruleCheck.metrics.maxDrawdown)
          : toNumber(ruleCheck.metrics.maxDrawdownPercent);
      const currentPeakProfit = getCurrentPeakProfitValue(
        metricMode,
        currentPhase.maxLossType,
        currentResult,
        currentDrawdown
      );
      const profitTarget = toNumber(currentPhase.profitTarget);
      const dailyLossLimit =
        currentPhase.dailyLossLimit != null
          ? toNumber(currentPhase.dailyLossLimit)
          : null;
      const maxLoss =
        currentPhase.maxLoss != null ? toNumber(currentPhase.maxLoss) : null;
      const remainingDays = Math.max(
        0,
        ruleCheck.metrics.daysRemaining ??
          toNumber(currentPhase.timeLimitDays || 365)
      );
      const currentTradingDays = Math.max(
        0,
        toNumber(ruleCheck.metrics.tradingDays)
      );
      const minTradingDays = Math.max(0, toNumber(currentPhase.minTradingDays));
      const targetRemaining = Math.max(0, profitTarget - currentResult);
      const tradingDayRate = Math.min(
        1,
        Math.max(
          0.1,
          observedCalendarDays > 0
            ? observedTradingDays / observedCalendarDays
            : 1
        )
      );
      const shrunkMean = avgDailyReturn * sampleConfidence;
      const volatilityFloor =
        metricMode === "currency"
          ? Math.max(
              50,
              Math.abs(avgDailyReturn) * 0.35,
              targetRemaining * 0.08
            )
          : Math.max(
              0.2,
              Math.abs(avgDailyReturn) * 0.35,
              targetRemaining * 0.08
            );
      const stdDev = Math.max(rawStdDev, volatilityFloor);

      if (
        remainingDays === 0 &&
        !(currentResult >= profitTarget && currentTradingDays >= minTradingDays)
      ) {
        return {
          passPercentage: 0,
          daysToTarget: null,
          avgDailyReturn,
          stdDev,
          riskOfFailure: 100,
          message: "No time remains in the current phase window.",
        };
      }

      if (
        currentResult >= profitTarget &&
        currentTradingDays >= minTradingDays
      ) {
        return {
          passPercentage: 99.9,
          daysToTarget: 0,
          avgDailyReturn,
          stdDev,
          riskOfFailure: 0.1,
          message:
            "The live rule state already satisfies the target and minimum trading days.",
        };
      }

      // Monte Carlo simulation with empirical sampling + uncertainty floor.
      const simulations = 1500;
      let passCount = 0;
      const daysToTargetSamples: number[] = [];

      for (let i = 0; i < simulations; i++) {
        let profit = currentResult;
        let peakProfit = currentPeakProfit;
        let tradingDays = currentTradingDays;
        let failed = false;
        let passed = false;

        for (let day = 0; day < remainingDays; day++) {
          const isTradingDay = Math.random() <= tradingDayRate;

          if (!isTradingDay) {
            if (profit >= profitTarget && tradingDays >= minTradingDays) {
              passCount++;
              daysToTargetSamples.push(day + 1);
              passed = true;
              break;
            }

            continue;
          }

          tradingDays += 1;

          const empiricalReturn = sampleOne(dailyReturns);
          const gaussianReturn = shrunkMean + stdDev * gaussianishSample();
          const dailyReturn = empiricalReturn * 0.65 + gaussianReturn * 0.35;
          const simulatedDailyDrawdown =
            Math.max(0, -dailyReturn) * (1 + Math.random() * 0.35);

          if (
            dailyLossLimit !== null &&
            simulatedDailyDrawdown > dailyLossLimit
          ) {
            failed = true;
            break;
          }

          profit += dailyReturn;
          peakProfit = Math.max(peakProfit, profit);

          const simulatedMaxDrawdown =
            maxLoss !== null
              ? getMaxDrawdownValueFromPeak(
                  metricMode,
                  currentPhase.maxLossType,
                  profit,
                  peakProfit,
                  Math.max(1, toNumber(account.propPhaseStartBalance))
                )
              : 0;

          if (maxLoss !== null && simulatedMaxDrawdown > maxLoss) {
            failed = true;
            break;
          }

          if (profit >= profitTarget && tradingDays >= minTradingDays) {
            passCount++;
            daysToTargetSamples.push(day + 1);
            passed = true;
            break;
          }
        }

        if (passed || failed) {
          continue;
        }
      }

      const passPercentage = ((passCount + 1) / (simulations + 2)) * 100;
      const avgDaysToTarget =
        daysToTargetSamples.length > 0
          ? daysToTargetSamples.reduce((a, b) => a + b, 0) /
            daysToTargetSamples.length
          : null;
      const requiredTradingDaysRemaining = Math.max(
        0,
        minTradingDays - currentTradingDays
      );

      return {
        passPercentage,
        daysToTarget: avgDaysToTarget ? Math.ceil(avgDaysToTarget) : null,
        riskOfFailure: 100 - passPercentage,
        avgDailyReturn,
        stdDev,
        message: `Simulation uses ${dailyReturns.length} observed phase day(s), ${remainingDays} remaining day(s), and ${requiredTradingDaysRemaining} trading day(s) still required.`,
      };
    }),
});
