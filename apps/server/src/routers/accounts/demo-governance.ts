import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import {
  goal,
  performanceAlert,
  performanceAlertRule,
} from "../../db/schema/trading";

type SeedDemoGoalsAndAlertsInput = {
  userId: string;
  accountId: string;
  now: number;
  tradeDayKeys: string[];
  fallbackGoalDay: string;
  totalProfit: number;
  journalRate: number;
  ruleCompliance: number;
  checklistCompletionRate: number;
  breakAfterLoss: number;
  winRate: number;
  averageRR: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals = 1) {
  return Number(value.toFixed(decimals));
}

function shiftDateKey(dateKey: string, days: number) {
  const next = new Date(`${dateKey}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function buildProgressHistory(points: Array<{ date: string; value: number }>) {
  return points.map((point) => ({
    timestamp: `${point.date}T18:00:00.000Z`,
    value: roundTo(point.value, 1),
  }));
}

function buildAchievement(value: number, timestamp: string) {
  return [
    {
      type: "goal_completed",
      timestamp,
      value: roundTo(value, 1),
    },
  ];
}

export async function seedDemoGoalsAndAlerts(
  input: SeedDemoGoalsAndAlertsInput
) {
  const {
    userId,
    accountId,
    now,
    tradeDayKeys,
    fallbackGoalDay,
    totalProfit,
    journalRate,
    ruleCompliance,
    checklistCompletionRate,
    breakAfterLoss,
    winRate,
    averageRR,
  } = input;

  await db.delete(performanceAlert).where(
    and(
      eq(performanceAlert.userId, userId),
      eq(performanceAlert.accountId, accountId)
    )
  );
  await db.delete(performanceAlertRule).where(
    and(
      eq(performanceAlertRule.userId, userId),
      eq(performanceAlertRule.accountId, accountId)
    )
  );
  await db.delete(goal).where(
    and(eq(goal.userId, userId), eq(goal.accountId, accountId))
  );

  const lastTradeDay = tradeDayKeys.at(-1) ?? fallbackGoalDay;
  const firstTradeDay = tradeDayKeys.at(0) ?? shiftDateKey(lastTradeDay, -60);
  const activeWeekStart = shiftDateKey(lastTradeDay, -6);
  const activeMonthStart = shiftDateKey(lastTradeDay, -29);
  const previousMonthStart = shiftDateKey(activeMonthStart, -30);
  const previousMonthEnd = shiftDateKey(activeMonthStart, -1);
  const nowDate = new Date(now);

  const seededGoals: Array<typeof goal.$inferInsert> = [
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "weekly",
      targetType: "ruleCompliance",
      targetValue: "90",
      currentValue: roundTo(ruleCompliance, 1).toString(),
      startDate: activeWeekStart,
      deadline: lastTradeDay,
      title: "Keep rule compliance above 90%",
      description:
        "Hold execution quality through the week by keeping the share of aligned trades high.",
      status: ruleCompliance >= 90 ? "achieved" : "active",
      achievements:
        ruleCompliance >= 90
          ? buildAchievement(ruleCompliance, `${lastTradeDay}T18:00:00.000Z`)
          : [],
      progressHistory: buildProgressHistory([
        { date: activeWeekStart, value: clamp(ruleCompliance - 11, 52, 95) },
        { date: shiftDateKey(activeWeekStart, 2), value: clamp(ruleCompliance - 6, 60, 96) },
        { date: shiftDateKey(activeWeekStart, 4), value: clamp(ruleCompliance - 2, 68, 98) },
        { date: lastTradeDay, value: ruleCompliance },
      ]),
      isCustom: false,
      customCriteria: null,
      completedAt:
        ruleCompliance >= 90 ? new Date(`${lastTradeDay}T18:00:00.000Z`) : null,
      createdAt: new Date(`${activeWeekStart}T09:00:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "monthly",
      targetType: "journalRate",
      targetValue: "80",
      currentValue: roundTo(journalRate, 1).toString(),
      startDate: activeMonthStart,
      deadline: lastTradeDay,
      title: "Journal 80% of closed trades",
      description:
        "Keep reviews attached to most trades so the demo workspace feels lived in and coachable.",
      status: journalRate >= 80 ? "achieved" : "active",
      achievements:
        journalRate >= 80
          ? buildAchievement(journalRate, `${shiftDateKey(lastTradeDay, -1)}T18:00:00.000Z`)
          : [],
      progressHistory: buildProgressHistory([
        { date: activeMonthStart, value: clamp(journalRate - 18, 28, 82) },
        { date: shiftDateKey(activeMonthStart, 10), value: clamp(journalRate - 10, 35, 86) },
        { date: shiftDateKey(activeMonthStart, 20), value: clamp(journalRate - 4, 45, 92) },
        { date: lastTradeDay, value: journalRate },
      ]),
      isCustom: false,
      customCriteria: null,
      completedAt:
        journalRate >= 80
          ? new Date(`${shiftDateKey(lastTradeDay, -1)}T18:00:00.000Z`)
          : null,
      createdAt: new Date(`${activeMonthStart}T09:00:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "weekly",
      targetType: "breakAfterLoss",
      targetValue: "80",
      currentValue: roundTo(breakAfterLoss, 1).toString(),
      startDate: activeWeekStart,
      deadline: lastTradeDay,
      title: "Respect the post-loss reset",
      description:
        "Take the reset after a loss instead of clicking straight back in.",
      status: breakAfterLoss >= 80 ? "achieved" : "active",
      achievements:
        breakAfterLoss >= 80
          ? buildAchievement(breakAfterLoss, `${lastTradeDay}T17:30:00.000Z`)
          : [],
      progressHistory: buildProgressHistory([
        { date: activeWeekStart, value: clamp(breakAfterLoss - 22, 25, 85) },
        { date: shiftDateKey(activeWeekStart, 3), value: clamp(breakAfterLoss - 8, 35, 90) },
        { date: lastTradeDay, value: breakAfterLoss },
      ]),
      isCustom: false,
      customCriteria: null,
      completedAt:
        breakAfterLoss >= 80
          ? new Date(`${lastTradeDay}T17:30:00.000Z`)
          : null,
      createdAt: new Date(`${activeWeekStart}T10:30:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "monthly",
      targetType: "checklistCompletion",
      targetValue: "90",
      currentValue: roundTo(checklistCompletionRate, 1).toString(),
      startDate: activeMonthStart,
      deadline: lastTradeDay,
      title: "Finish 90% of the checklist",
      description:
        "Use the pre-trade checklist as a gate instead of filling it after the fact.",
      status: checklistCompletionRate >= 90 ? "achieved" : "active",
      achievements:
        checklistCompletionRate >= 90
          ? buildAchievement(
              checklistCompletionRate,
              `${shiftDateKey(lastTradeDay, -2)}T18:00:00.000Z`
            )
          : [],
      progressHistory: buildProgressHistory([
        { date: activeMonthStart, value: clamp(checklistCompletionRate - 16, 40, 88) },
        { date: shiftDateKey(activeMonthStart, 12), value: clamp(checklistCompletionRate - 9, 45, 91) },
        { date: shiftDateKey(activeMonthStart, 22), value: clamp(checklistCompletionRate - 3, 55, 95) },
        { date: lastTradeDay, value: checklistCompletionRate },
      ]),
      isCustom: false,
      customCriteria: null,
      completedAt:
        checklistCompletionRate >= 90
          ? new Date(`${shiftDateKey(lastTradeDay, -2)}T18:00:00.000Z`)
          : null,
      createdAt: new Date(`${activeMonthStart}T11:00:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "monthly",
      targetType: "winRate",
      targetValue: "58",
      currentValue: roundTo(winRate, 1).toString(),
      startDate: activeMonthStart,
      deadline: lastTradeDay,
      title: "Keep win rate above 58%",
      description:
        "Sustain clean execution quality and avoid giving back progress during rough clusters.",
      status: winRate >= 58 ? "achieved" : "active",
      achievements:
        winRate >= 58
          ? buildAchievement(winRate, `${lastTradeDay}T19:00:00.000Z`)
          : [],
      progressHistory: buildProgressHistory([
        { date: activeMonthStart, value: clamp(winRate - 9, 41, 60) },
        { date: shiftDateKey(activeMonthStart, 15), value: clamp(winRate - 4, 45, 63) },
        { date: lastTradeDay, value: winRate },
      ]),
      isCustom: false,
      customCriteria: null,
      completedAt:
        winRate >= 58 ? new Date(`${lastTradeDay}T19:00:00.000Z`) : null,
      createdAt: new Date(`${activeMonthStart}T08:00:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "milestone",
      targetType: "rr",
      targetValue: "1.8",
      currentValue: roundTo(averageRR, 2).toString(),
      startDate: firstTradeDay,
      deadline: null,
      title: "Average 1.8R across the sample",
      description:
        "Build a higher-quality sample by protecting downside and holding better when the Edge is clean.",
      status: averageRR >= 1.8 ? "achieved" : "active",
      achievements:
        averageRR >= 1.8
          ? buildAchievement(averageRR, `${lastTradeDay}T20:00:00.000Z`)
          : [],
      progressHistory: buildProgressHistory([
        { date: shiftDateKey(firstTradeDay, 20), value: clamp(averageRR - 0.55, 0.45, 1.7) },
        { date: shiftDateKey(firstTradeDay, 55), value: clamp(averageRR - 0.18, 0.8, 1.9) },
        { date: lastTradeDay, value: averageRR },
      ]),
      isCustom: false,
      customCriteria: null,
      completedAt:
        averageRR >= 1.8 ? new Date(`${lastTradeDay}T20:00:00.000Z`) : null,
      createdAt: new Date(`${firstTradeDay}T08:30:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      type: "monthly",
      targetType: "profit",
      targetValue: "5000",
      currentValue: roundTo(clamp(totalProfit * 0.72, -2000, 4200), 2).toString(),
      startDate: previousMonthStart,
      deadline: previousMonthEnd,
      title: "Finish the month green by $5,000",
      description:
        "A prior month target left on the board to make the workspace feel like it has history.",
      status: "failed",
      achievements: [],
      progressHistory: buildProgressHistory([
        { date: previousMonthStart, value: 0 },
        { date: shiftDateKey(previousMonthStart, 10), value: roundTo(totalProfit * 0.18, 2) },
        { date: shiftDateKey(previousMonthStart, 20), value: roundTo(totalProfit * 0.41, 2) },
        { date: previousMonthEnd, value: clamp(totalProfit * 0.72, -2000, 4200) },
      ]),
      isCustom: false,
      customCriteria: null,
      completedAt: new Date(`${previousMonthEnd}T18:00:00.000Z`),
      createdAt: new Date(`${previousMonthStart}T08:00:00.000Z`),
      updatedAt: nowDate,
    },
  ];

  await db.insert(goal).values(seededGoals);

  const seededRules: Array<typeof performanceAlertRule.$inferInsert> = [
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      name: "Daily loss guard",
      ruleType: "daily_loss",
      thresholdValue: "1200",
      thresholdUnit: "usd",
      alertSeverity: "critical",
      isEnabled: true,
      notifyInApp: true,
      notifyEmail: false,
      cooldownMinutes: 120,
      createdAt: new Date(`${activeMonthStart}T09:30:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      name: "Loss streak warning",
      ruleType: "loss_streak",
      thresholdValue: "3",
      thresholdUnit: "count",
      alertSeverity: "warning",
      isEnabled: true,
      notifyInApp: true,
      notifyEmail: false,
      cooldownMinutes: 180,
      createdAt: new Date(`${activeMonthStart}T09:45:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      name: "Win streak highlight",
      ruleType: "win_streak",
      thresholdValue: "4",
      thresholdUnit: "count",
      alertSeverity: "info",
      isEnabled: true,
      notifyInApp: true,
      notifyEmail: false,
      cooldownMinutes: 60,
      createdAt: new Date(`${activeMonthStart}T10:00:00.000Z`),
      updatedAt: nowDate,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      name: "Tilt detection",
      ruleType: "tilt_detected",
      thresholdValue: "1",
      thresholdUnit: "count",
      alertSeverity: "critical",
      isEnabled: true,
      notifyInApp: true,
      notifyEmail: false,
      cooldownMinutes: 240,
      createdAt: new Date(`${activeMonthStart}T10:15:00.000Z`),
      updatedAt: nowDate,
    },
  ];

  await db.insert(performanceAlertRule).values(seededRules);

  const dailyLossRule = seededRules[0]!;
  const tiltRule = seededRules[3]!;
  const seededAlerts: Array<typeof performanceAlert.$inferInsert> = [
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      ruleId: dailyLossRule.id,
      alertType: "daily_loss",
      severity: "warning",
      title: "Daily drawdown nearly breached",
      message:
        "One of the leak-cluster sessions pushed close to the daily loss guard. Size and revenge pacing were cleaned up after review.",
      currentValue: "980",
      thresholdValue: dailyLossRule.thresholdValue,
      acknowledged: true,
      acknowledgedAt: new Date(`${shiftDateKey(lastTradeDay, -19)}T16:45:00.000Z`),
      metadata: {
        source: "demo_seed",
        context: "leak-cluster",
      },
      createdAt: new Date(`${shiftDateKey(lastTradeDay, -19)}T16:10:00.000Z`),
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId,
      ruleId: tiltRule.id,
      alertType: "tilt_detected",
      severity: "critical",
      title: "Tilt pattern detected after consecutive losses",
      message:
        "Back-to-back losses compressed the reset window and forced an immediate review. This stays unacknowledged so the alerts panel has live demo data.",
      currentValue: "1",
      thresholdValue: tiltRule.thresholdValue,
      acknowledged: false,
      acknowledgedAt: null,
      metadata: {
        source: "demo_seed",
        breakAfterLoss,
      },
      createdAt: new Date(`${shiftDateKey(lastTradeDay, -2)}T14:40:00.000Z`),
    },
  ];

  await db.insert(performanceAlert).values(seededAlerts);

  return {
    createdGoals: seededGoals.length,
    createdAlertRules: seededRules.length,
    createdAlerts: seededAlerts.length,
  } as const;
}
