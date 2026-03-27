import { z } from "zod";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import {
  edge,
  performanceAlertRule,
  performanceAlert,
  trade,
  tradeEdgeAssignment,
  tradeEdgeRuleEvaluation,
  tradingAccount,
} from "../db/schema/trading";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createNotification } from "../lib/notifications";

const ruleTypeEnum = z.enum([
  "daily_loss",
  "max_drawdown",
  "win_streak",
  "loss_streak",
  "consecutive_green",
  "consecutive_red",
  // Pattern-based
  "win_rate_drop",
  "profit_factor_drop",
  "tilt_detected",
  "edge_condition_met",
]);

const thresholdUnitEnum = z.enum(["percent", "usd", "count"]);
const severityEnum = z.enum(["info", "warning", "critical"]);

export type EdgeConditionAlertCandidate = {
  tradeId: string;
  edgeId: string;
  edgeName: string;
  symbol: string | null;
  sessionTag: string | null;
  closeTime: Date | null;
  followedCount: number;
  brokenCount: number;
  notReviewedCount: number;
};

function pluralizeRuleLabel(count: number) {
  return `${count} rule${count === 1 ? "" : "s"}`;
}

function buildEdgeTradeLabel(candidate: Pick<EdgeConditionAlertCandidate, "symbol" | "sessionTag">) {
  const symbolLabel = candidate.symbol?.trim() || "the latest trade";
  const sessionLabel = candidate.sessionTag?.trim();
  return sessionLabel ? `${symbolLabel} during ${sessionLabel}` : symbolLabel;
}

export function evaluateEdgeConditionMetCandidates(args: {
  threshold: number;
  thresholdUnit: z.infer<typeof thresholdUnitEnum>;
  candidates: EdgeConditionAlertCandidate[];
}) {
  for (const candidate of args.candidates) {
    const applicableCount =
      candidate.followedCount + candidate.brokenCount + candidate.notReviewedCount;

    if (candidate.followedCount <= 0 || applicableCount <= 0) {
      continue;
    }

    if (candidate.brokenCount > 0) {
      continue;
    }

    let currentValue = 0;
    if (args.thresholdUnit === "count") {
      currentValue = candidate.followedCount;
    } else if (args.thresholdUnit === "percent") {
      currentValue = (candidate.followedCount / applicableCount) * 100;
    } else {
      continue;
    }

    if (currentValue < args.threshold) {
      continue;
    }

    const tradeLabel = buildEdgeTradeLabel(candidate);
    const title = "Edge Condition Met";
    const message =
      args.thresholdUnit === "percent"
        ? `${candidate.edgeName} reached ${currentValue.toFixed(0)}% reviewed rule alignment on ${tradeLabel}.`
        : `${candidate.edgeName} matched ${pluralizeRuleLabel(
            candidate.followedCount
          )} on ${tradeLabel} with no broken edge conditions.`;

    return {
      candidate,
      currentValue,
      title,
      message,
      metadata: {
        kind: "edge_condition",
        edgeId: candidate.edgeId,
        edgeName: candidate.edgeName,
        tradeId: candidate.tradeId,
        symbol: candidate.symbol,
        sessionTag: candidate.sessionTag,
        followedCount: candidate.followedCount,
        brokenCount: candidate.brokenCount,
        notReviewedCount: candidate.notReviewedCount,
      } satisfies Record<string, unknown>,
    };
  }

  return null;
}

export const alertsRouter = router({
  // List all alert rules for a user
  listRules: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const conditions = [eq(performanceAlertRule.userId, userId)];
      if (input?.accountId) {
        conditions.push(eq(performanceAlertRule.accountId, input.accountId));
      }

      return db
        .select()
        .from(performanceAlertRule)
        .where(and(...conditions))
        .orderBy(desc(performanceAlertRule.createdAt));
    }),

  // Create a new alert rule
  createRule: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
      name: z.string().min(1).max(100),
      ruleType: ruleTypeEnum,
      thresholdValue: z.number().positive(),
      thresholdUnit: thresholdUnitEnum,
      alertSeverity: severityEnum.optional(),
      notifyInApp: z.boolean().optional(),
      notifyEmail: z.boolean().optional(),
      cooldownMinutes: z.number().int().min(0).optional(),
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

      const [rule] = await db
        .insert(performanceAlertRule)
        .values({
          userId,
          accountId: input.accountId || null,
          name: input.name,
          ruleType: input.ruleType,
          thresholdValue: input.thresholdValue.toString(),
          thresholdUnit: input.thresholdUnit,
          alertSeverity: input.alertSeverity || "warning",
          notifyInApp: input.notifyInApp ?? true,
          notifyEmail: input.notifyEmail ?? false,
          cooldownMinutes: input.cooldownMinutes ?? 60,
        })
        .returning();

      return rule;
    }),

  // Update an alert rule
  updateRule: protectedProcedure
    .input(z.object({
      ruleId: z.string(),
      name: z.string().min(1).max(100).optional(),
      thresholdValue: z.number().positive().optional(),
      alertSeverity: severityEnum.optional(),
      isEnabled: z.boolean().optional(),
      notifyInApp: z.boolean().optional(),
      notifyEmail: z.boolean().optional(),
      cooldownMinutes: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const existing = await db
        .select({ id: performanceAlertRule.id })
        .from(performanceAlertRule)
        .where(and(eq(performanceAlertRule.id, input.ruleId), eq(performanceAlertRule.userId, userId)))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.thresholdValue !== undefined) updates.thresholdValue = input.thresholdValue.toString();
      if (input.alertSeverity !== undefined) updates.alertSeverity = input.alertSeverity;
      if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;
      if (input.notifyInApp !== undefined) updates.notifyInApp = input.notifyInApp;
      if (input.notifyEmail !== undefined) updates.notifyEmail = input.notifyEmail;
      if (input.cooldownMinutes !== undefined) updates.cooldownMinutes = input.cooldownMinutes;

      const [rule] = await db
        .update(performanceAlertRule)
        .set(updates)
        .where(eq(performanceAlertRule.id, input.ruleId))
        .returning();

      return rule;
    }),

  // Delete an alert rule
  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .delete(performanceAlertRule)
        .where(and(eq(performanceAlertRule.id, input.ruleId), eq(performanceAlertRule.userId, userId)));

      return { ok: true };
    }),

  // List triggered alerts
  listAlerts: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
      unacknowledgedOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const limit = input?.limit ?? 50;

      const conditions = [eq(performanceAlert.userId, userId)];
      if (input?.accountId) {
        conditions.push(eq(performanceAlert.accountId, input.accountId));
      }
      if (input?.unacknowledgedOnly) {
        conditions.push(eq(performanceAlert.acknowledged, false));
      }

      return db
        .select()
        .from(performanceAlert)
        .where(and(...conditions))
        .orderBy(desc(performanceAlert.createdAt))
        .limit(limit);
    }),

  // Acknowledge alerts
  acknowledgeAlerts: protectedProcedure
    .input(z.object({ alertIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .update(performanceAlert)
        .set({ acknowledged: true, acknowledgedAt: new Date() })
        .where(and(
          eq(performanceAlert.userId, userId),
          inArray(performanceAlert.id, input.alertIds)
        ));

      return { ok: true };
    }),

  // Check and trigger alerts for an account (called after trade close or periodically)
  checkAlerts: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const accountId = input.accountId;

      // Verify ownership
      const account = await db
        .select({
          id: tradingAccount.id,
          initialBalance: tradingAccount.initialBalance,
          liveBalance: tradingAccount.liveBalance,
        })
        .from(tradingAccount)
        .where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)))
        .limit(1);

      if (!account[0]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
      }

      // Get enabled rules for this account
      const rules = await db
        .select()
        .from(performanceAlertRule)
        .where(and(
          eq(performanceAlertRule.userId, userId),
          eq(performanceAlertRule.isEnabled, true),
          sql`(${performanceAlertRule.accountId} = ${accountId} OR ${performanceAlertRule.accountId} IS NULL)`
        ));

      const triggeredAlerts: Array<{ ruleId: string; title: string; message: string }> = [];
      const now = new Date();

      for (const rule of rules) {
        // Check cooldown
        if (rule.lastTriggeredAt) {
          const cooldownMs = (rule.cooldownMinutes || 60) * 60 * 1000;
          if (now.getTime() - rule.lastTriggeredAt.getTime() < cooldownMs) {
            continue;
          }
        }

        const threshold = parseFloat(rule.thresholdValue || "0");
        let shouldTrigger = false;
        let currentValue = 0;
        let title = "";
        let message = "";
        let alertMetadata: Record<string, unknown> | null = null;

        switch (rule.ruleType) {
          case "daily_loss": {
            // Calculate today's P&L
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayTrades = await db
              .select({
                totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
              })
              .from(trade)
              .where(and(
                eq(trade.accountId, accountId),
                gte(trade.closeTime, today)
              ));

            const dailyPL = todayTrades[0]?.totalProfit || 0;
            const initialBalance = parseFloat(account[0].initialBalance || "10000");
            
            if (rule.thresholdUnit === "percent") {
              currentValue = Math.abs(dailyPL / initialBalance * 100);
              shouldTrigger = dailyPL < 0 && currentValue >= threshold;
              title = "Daily Loss Limit Alert";
              message = `Daily loss of ${currentValue.toFixed(2)}% exceeds your ${threshold}% threshold`;
            } else {
              currentValue = Math.abs(dailyPL);
              shouldTrigger = dailyPL < 0 && currentValue >= threshold;
              title = "Daily Loss Limit Alert";
              message = `Daily loss of $${currentValue.toFixed(2)} exceeds your $${threshold} threshold`;
            }
            break;
          }

          case "max_drawdown": {
            // Calculate total drawdown from initial balance
            const totalProfitResult = await db
              .select({
                total: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
              })
              .from(trade)
              .where(eq(trade.accountId, accountId));

            const totalProfit = totalProfitResult[0]?.total || 0;
            const initialBalance = parseFloat(account[0].initialBalance || "10000");
            
            if (rule.thresholdUnit === "percent") {
              currentValue = Math.abs(Math.min(0, totalProfit) / initialBalance * 100);
              shouldTrigger = totalProfit < 0 && currentValue >= threshold;
              title = "Max Drawdown Alert";
              message = `Account drawdown of ${currentValue.toFixed(2)}% exceeds your ${threshold}% threshold`;
            } else {
              currentValue = Math.abs(Math.min(0, totalProfit));
              shouldTrigger = totalProfit < 0 && currentValue >= threshold;
              title = "Max Drawdown Alert";
              message = `Account drawdown of $${currentValue.toFixed(2)} exceeds your $${threshold} threshold`;
            }
            break;
          }

          case "win_streak":
          case "loss_streak": {
            // Get recent trades ordered by close time
            const recentTrades = await db
              .select({ outcome: trade.outcome })
              .from(trade)
              .where(and(eq(trade.accountId, accountId), sql`${trade.outcome} IS NOT NULL`))
              .orderBy(desc(trade.closeTime))
              .limit(50);

            const isWinStreak = rule.ruleType === "win_streak";
            let streak = 0;
            
            for (const t of recentTrades) {
              const isWin = t.outcome === "Win" || t.outcome === "PW";
              if ((isWinStreak && isWin) || (!isWinStreak && !isWin)) {
                streak++;
              } else {
                break;
              }
            }

            currentValue = streak;
            shouldTrigger = streak >= threshold;
            title = isWinStreak ? "Win Streak Alert" : "Loss Streak Alert";
            message = isWinStreak 
              ? `You're on a ${streak}-trade winning streak!`
              : `Warning: ${streak} consecutive losing trades`;
            break;
          }

          case "consecutive_green":
          case "consecutive_red": {
            // Get daily P&L grouped by date
            const dailyPL = await db
              .select({
                date: sql<string>`DATE(${trade.closeTime})`,
                profit: sql<number>`SUM(CAST(${trade.profit} AS NUMERIC))`,
              })
              .from(trade)
              .where(and(eq(trade.accountId, accountId), sql`${trade.closeTime} IS NOT NULL`))
              .groupBy(sql`DATE(${trade.closeTime})`)
              .orderBy(desc(sql`DATE(${trade.closeTime})`))
              .limit(30);

            const isGreenStreak = rule.ruleType === "consecutive_green";
            let streak = 0;
            
            for (const day of dailyPL) {
              const isGreen = day.profit > 0;
              if ((isGreenStreak && isGreen) || (!isGreenStreak && !isGreen)) {
                streak++;
              } else {
                break;
              }
            }

            currentValue = streak;
            shouldTrigger = streak >= threshold;
            title = isGreenStreak ? "Green Day Streak Alert" : "Red Day Streak Alert";
            message = isGreenStreak
              ? `Congratulations! ${streak} consecutive green days!`
              : `Warning: ${streak} consecutive red days`;
            break;
          }

          case "edge_condition_met": {
            const candidateConditions = [
              eq(trade.accountId, accountId),
              eq(tradeEdgeAssignment.userId, userId),
              sql`${trade.closeTime} IS NOT NULL`,
            ];

            if (rule.lastTriggeredAt) {
              candidateConditions.push(gte(trade.closeTime, rule.lastTriggeredAt));
            }

            const candidateTrades = await db
              .select({
                tradeId: trade.id,
                edgeId: edge.id,
                edgeName: edge.name,
                symbol: trade.symbol,
                sessionTag: trade.sessionTag,
                closeTime: trade.closeTime,
              })
              .from(tradeEdgeAssignment)
              .innerJoin(trade, eq(trade.id, tradeEdgeAssignment.tradeId))
              .innerJoin(edge, eq(edge.id, tradeEdgeAssignment.edgeId))
              .where(and(...candidateConditions))
              .orderBy(desc(trade.closeTime))
              .limit(25);

            if (candidateTrades.length === 0) {
              break;
            }

            const evaluationRows = await db
              .select({
                tradeId: tradeEdgeRuleEvaluation.tradeId,
                edgeId: tradeEdgeRuleEvaluation.edgeId,
                status: tradeEdgeRuleEvaluation.status,
              })
              .from(tradeEdgeRuleEvaluation)
              .where(
                inArray(
                  tradeEdgeRuleEvaluation.tradeId,
                  candidateTrades.map((candidateTrade) => candidateTrade.tradeId)
                )
              );

            const evaluationCounts = new Map<
              string,
              Pick<
                EdgeConditionAlertCandidate,
                "followedCount" | "brokenCount" | "notReviewedCount"
              >
            >();

            for (const evaluation of evaluationRows) {
              const key = `${evaluation.tradeId}:${evaluation.edgeId}`;
              const currentCounts = evaluationCounts.get(key) ?? {
                followedCount: 0,
                brokenCount: 0,
                notReviewedCount: 0,
              };

              if (evaluation.status === "followed") {
                currentCounts.followedCount += 1;
              } else if (evaluation.status === "broken") {
                currentCounts.brokenCount += 1;
              } else if (evaluation.status === "not_reviewed") {
                currentCounts.notReviewedCount += 1;
              }

              evaluationCounts.set(key, currentCounts);
            }

            const evaluatedCandidates: EdgeConditionAlertCandidate[] =
              candidateTrades.map((candidateTrade) => {
                const counts =
                  evaluationCounts.get(
                    `${candidateTrade.tradeId}:${candidateTrade.edgeId}`
                  ) ?? {
                    followedCount: 0,
                    brokenCount: 0,
                    notReviewedCount: 0,
                  };

                return {
                  ...candidateTrade,
                  ...counts,
                };
              });

            const edgeAlertEvaluation = evaluateEdgeConditionMetCandidates({
              threshold,
              thresholdUnit: rule.thresholdUnit as z.infer<
                typeof thresholdUnitEnum
              >,
              candidates: evaluatedCandidates,
            });

            if (!edgeAlertEvaluation) {
              break;
            }

            shouldTrigger = true;
            currentValue = edgeAlertEvaluation.currentValue;
            title = edgeAlertEvaluation.title;
            message = edgeAlertEvaluation.message;
            alertMetadata = edgeAlertEvaluation.metadata;
            break;
          }
        }

        if (shouldTrigger) {
          // Create alert record
          await db.insert(performanceAlert).values({
            userId,
            accountId,
            ruleId: rule.id,
            alertType: rule.ruleType,
            severity: rule.alertSeverity || "warning",
            title,
            message,
            currentValue: currentValue.toString(),
            thresholdValue: threshold.toString(),
            metadata: alertMetadata,
          });

          // Update last triggered time
          await db
            .update(performanceAlertRule)
            .set({ lastTriggeredAt: now })
            .where(eq(performanceAlertRule.id, rule.id));

          // Create in-app notification if enabled
          if (rule.notifyInApp) {
            await createNotification({
              userId,
              accountId,
              type: "alert_triggered",
              title,
              body: message,
              metadata: {
                kind: "risk_warning",
                ruleName: rule.name,
                alertType: rule.ruleType,
                severity: rule.alertSeverity,
                currentValue,
                thresholdValue: threshold,
                ...(alertMetadata ?? {}),
              },
            });
          }

          triggeredAlerts.push({ ruleId: rule.id, title, message });
        }
      }

      return { triggeredAlerts, checkedRulesCount: rules.length };
    }),

  // Get alert summary/stats
  getSummary: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const conditions = [eq(performanceAlert.userId, userId)];
      if (input?.accountId) {
        conditions.push(eq(performanceAlert.accountId, input.accountId));
      }

      // Count unacknowledged by severity
      const stats = await db
        .select({
          severity: performanceAlert.severity,
          count: sql<number>`COUNT(*)`,
        })
        .from(performanceAlert)
        .where(and(...conditions, eq(performanceAlert.acknowledged, false)))
        .groupBy(performanceAlert.severity);

      const bySeverity: Record<string, number> = {};
      let total = 0;
      for (const s of stats) {
        bySeverity[s.severity] = s.count;
        total += s.count;
      }

      // Count rules
      const ruleConditions = [eq(performanceAlertRule.userId, userId)];
      if (input?.accountId) {
        ruleConditions.push(eq(performanceAlertRule.accountId, input.accountId));
      }

      const ruleCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(performanceAlertRule)
        .where(and(...ruleConditions));

      return {
        unacknowledgedTotal: total,
        bySeverity,
        activeRulesCount: ruleCount[0]?.count ?? 0,
      };
    }),

  /**
   * Create preset pattern-based alert rules
   */
  createPatternAlerts: protectedProcedure
    .input(z.object({
      accountId: z.string().optional(),
      presets: z.array(z.enum([
        "daily_loss_warning",
        "drawdown_critical",
        "win_streak_celebrate",
        "loss_streak_warning",
        "tilt_detection",
      ])),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const presetDefs: Record<string, {
        name: string;
        ruleType: string;
        thresholdValue: number;
        thresholdUnit: string;
        severity: string;
      }> = {
        daily_loss_warning: {
          name: "Daily Loss Warning",
          ruleType: "daily_loss",
          thresholdValue: 2,
          thresholdUnit: "percent",
          severity: "warning",
        },
        drawdown_critical: {
          name: "Max Drawdown Alert",
          ruleType: "max_drawdown",
          thresholdValue: 5,
          thresholdUnit: "percent",
          severity: "critical",
        },
        win_streak_celebrate: {
          name: "Win Streak Milestone",
          ruleType: "win_streak",
          thresholdValue: 5,
          thresholdUnit: "count",
          severity: "info",
        },
        loss_streak_warning: {
          name: "Loss Streak Warning",
          ruleType: "loss_streak",
          thresholdValue: 3,
          thresholdUnit: "count",
          severity: "warning",
        },
        tilt_detection: {
          name: "Tilt Detection",
          ruleType: "tilt_detected",
          thresholdValue: 3,
          thresholdUnit: "count",
          severity: "critical",
        },
      };

      const created = [];
      for (const preset of input.presets) {
        const def = presetDefs[preset];
        if (!def) continue;

        const [rule] = await db
          .insert(performanceAlertRule)
          .values({
            userId,
            accountId: input.accountId || null,
            name: def.name,
            ruleType: def.ruleType,
            thresholdValue: def.thresholdValue.toString(),
            thresholdUnit: def.thresholdUnit,
            alertSeverity: def.severity,
            isEnabled: true,
            notifyInApp: true,
            notifyEmail: false,
          })
          .returning();

        created.push(rule);
      }

      return { created, count: created.length };
    }),
});
