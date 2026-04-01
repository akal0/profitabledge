import { db } from "../db";
import {
  tradingAccount,
  propAlert,
  propDailySnapshot,
  trade,
  openTrade,
} from "../db/schema/trading";
import { eq, and, gte, desc, or, sql } from "drizzle-orm";
import {
  getChallengeRuleById,
  resolvePropTrackingSeed,
} from "./prop-firm-detection";
import { createNotification } from "./notifications";
import {
  ensurePropChallengeLineageForAccount,
  recordPropChallengePhaseAdvance,
  syncPropChallengeOutcomeForAccount,
} from "./prop-challenge-lineage";
import {
  buildPropAlertNotification,
  formatMetricValue,
  getClosedTradeNetPnl,
  getOpenTradeNetPnl,
  getPassedPhaseCount,
  getPhaseTargetAbsolute,
  getRealizationDayKey,
  getTradingDayKey,
  toDayKey,
  toFixedMetric,
  toNumber,
} from "./prop-rule-monitor-helpers";

/**
 * Prop Firm Rule Monitoring Library
 * Monitors prop firm challenge rules and generates alerts
 */

export interface PropPhaseRules {
  profitTarget: number | null;
  profitTargetType: "percentage" | "absolute";
  dailyLossLimit: number | null;
  dailyLossLimitType?: "percentage" | "absolute" | null;
  maxLoss: number | null;
  maxLossType: "trailing" | "absolute";
  timeLimitDays: number | null;
  minTradingDays: number;
  consistencyRule: number | null;
  customRules?: Record<string, any>;
}

export type PropPhaseStatus = "active" | "passed" | "failed" | "paused";

export interface RuleCheckResult {
  passed: boolean;
  phaseStatus: PropPhaseStatus;
  alerts: Array<{
    type: "warning" | "breach" | "milestone";
    severity: "info" | "warning" | "critical";
    rule: string;
    message: string;
    currentValue: number;
    thresholdValue: number;
  }>;
  metrics: {
    currentBalance: number;
    currentEquity: number;
    dailyHighWaterMark: number;
    phaseHighWaterMark: number;
    currentProfit: number;
    currentProfitPercent: number;
    dailyDrawdown: number;
    dailyDrawdownPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    maxDrawdownTaken: number;
    maxDrawdownTakenPercent: number;
    tradingDays: number;
    daysRemaining: number | null;
    bestDayProfit: number;
    bestDayProfitPercent: number;
  };
  completion: {
    targetMet: boolean;
    minTradingDaysMet: boolean;
  };
}

type CheckPropRuleOptions = {
  persist?: boolean;
  saveAlerts?: boolean;
};

async function repairPropTrackingBaselineIfNeeded(accountId: string) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
    columns: {
      id: true,
      broker: true,
      brokerServer: true,
      initialBalance: true,
      liveBalance: true,
      liveEquity: true,
      isPropAccount: true,
      propChallengeRuleId: true,
      propCurrentPhase: true,
      propPhaseStartDate: true,
      propPhaseStartBalance: true,
      propPhaseCurrentProfitPercent: true,
      propPhaseTradingDays: true,
    },
  });

  if (
    !account ||
    !account.isPropAccount ||
    !account.propChallengeRuleId ||
    account.propCurrentPhase !== 1
  ) {
    return;
  }

  const initialBalance = toNumber(account.initialBalance);
  const liveBalance = toNumber(account.liveBalance);
  const storedStartBalance = toNumber(account.propPhaseStartBalance);
  const storedStartDate = account.propPhaseStartDate
    ? toDayKey(new Date(account.propPhaseStartDate))
    : null;
  const trackedProfitPercent = Math.abs(
    toNumber(account.propPhaseCurrentProfitPercent)
  );
  const trackedTradingDays = toNumber(account.propPhaseTradingDays);
  const zeroedProgress =
    trackedProfitPercent < 0.01 && trackedTradingDays === 0;
  const seededAtCurrentBalance =
    trackedProfitPercent < 0.01 &&
    liveBalance > 0 &&
    Math.abs(liveBalance - storedStartBalance) < 0.01 &&
    Math.abs(initialBalance - storedStartBalance) > 0.01;
  const likelyBadPhaseOneSeed =
    trackedProfitPercent < 0.01 &&
    trackedTradingDays <= 1 &&
    Math.abs(initialBalance - storedStartBalance) > 0.01;

  if (
    initialBalance <= 0 ||
    (!zeroedProgress && !seededAtCurrentBalance && !likelyBadPhaseOneSeed)
  ) {
    return;
  }

  const resolvedSeed = await resolvePropTrackingSeed(
    {
      accountId: account.id,
      broker: account.broker,
      brokerServer: account.brokerServer,
      initialBalance: account.initialBalance,
      liveBalance: account.liveBalance,
      liveEquity: account.liveEquity,
    },
    {
      phaseStartDate: storedStartDate,
    }
  );

  const needsBalanceRepair =
    Math.abs(resolvedSeed.startBalance - storedStartBalance) > 0.01;
  const needsDateRepair =
    storedStartDate == null || resolvedSeed.phaseStartDate < storedStartDate;

  if (!needsBalanceRepair && !needsDateRepair) {
    return;
  }

  await db
    .update(tradingAccount)
    .set({
      propPhaseStartDate: resolvedSeed.phaseStartDate,
      propPhaseStartBalance: resolvedSeed.startBalance.toFixed(2),
      propPhaseStartEquity: resolvedSeed.startEquity.toFixed(2),
      propDailyHighWaterMark: resolvedSeed.startEquity.toFixed(2),
      propPhaseHighWaterMark: resolvedSeed.startEquity.toFixed(2),
      propPhaseCurrentProfit: "0",
      propPhaseCurrentProfitPercent: "0",
      propPhaseTradingDays: 0,
      propPhaseBestDayProfit: "0",
      propPhaseBestDayProfitPercent: "0",
      propPhaseStatus: "active",
    })
    .where(eq(tradingAccount.id, accountId));
}

async function repairPropPhaseMetricsIfNeeded(accountId: string) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
    columns: {
      id: true,
      initialBalance: true,
      liveBalance: true,
      liveEquity: true,
      isPropAccount: true,
      propCurrentPhase: true,
      propPhaseStartBalance: true,
      propPhaseStartEquity: true,
      propPhaseCurrentProfit: true,
      propPhaseCurrentProfitPercent: true,
      propDailyHighWaterMark: true,
      propPhaseHighWaterMark: true,
    },
  });

  if (
    !account ||
    !account.isPropAccount ||
    account.propCurrentPhase == null ||
    account.propCurrentPhase === 1 ||
    account.liveBalance == null
  ) {
    return;
  }

  const phaseStartBalance = toNumber(
    account.propPhaseStartBalance ?? account.initialBalance
  );
  const phaseStartEquity = toNumber(
    account.propPhaseStartEquity ??
      account.propPhaseStartBalance ??
      account.initialBalance
  );
  const liveBalance = toNumber(account.liveBalance, phaseStartBalance);
  const liveEquity = toNumber(account.liveEquity, liveBalance);
  const expectedProfit = liveBalance - phaseStartBalance;
  const expectedProfitPercent =
    phaseStartBalance > 0 ? (expectedProfit / phaseStartBalance) * 100 : 0;
  const storedProfitPercent = toNumber(account.propPhaseCurrentProfitPercent);
  const storedPhaseHighWaterMark = toNumber(account.propPhaseHighWaterMark);
  const storedDailyHighWaterMark = toNumber(account.propDailyHighWaterMark);
  const expectedHighWaterMark = Math.max(phaseStartEquity, liveEquity);
  const metricsOutOfSync =
    Math.abs(storedProfitPercent - expectedProfitPercent) > 0.5;
  const phaseOpenedAtCurrentState =
    Math.abs(phaseStartEquity - liveEquity) < 0.01;
  const staleHighWaterMark =
    storedPhaseHighWaterMark > expectedHighWaterMark + 0.01 ||
    storedDailyHighWaterMark > expectedHighWaterMark + 0.01;

  if (
    (!metricsOutOfSync && !phaseOpenedAtCurrentState) ||
    !staleHighWaterMark
  ) {
    return;
  }

  await db
    .update(tradingAccount)
    .set({
      propPhaseCurrentProfit: expectedProfit.toFixed(2),
      propPhaseCurrentProfitPercent: expectedProfitPercent.toFixed(2),
      propDailyHighWaterMark: expectedHighWaterMark.toFixed(2),
      propPhaseHighWaterMark: expectedHighWaterMark.toFixed(2),
      propPhaseStatus: "active",
    })
    .where(eq(tradingAccount.id, accountId));
}

async function syncPropPhaseAdvancementIfNeeded(accountId: string) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (
    !account ||
    !account.isPropAccount ||
    !account.propChallengeRuleId ||
    account.propPhaseStatus === "failed" ||
    account.propPhaseStatus === "paused"
  ) {
    return false;
  }

  const challengeRule = await getChallengeRuleById(account.propChallengeRuleId);
  if (!challengeRule) {
    return false;
  }

  const challengePhases = (
    (challengeRule.phases as Array<
      PropPhaseRules & { order: number; name: string }
    >) || []
  )
    .filter((phase) => phase.order > 0)
    .sort((left, right) => left.order - right.order);

  if (!challengePhases.length) {
    return false;
  }

  const resolvedSeed = await resolvePropTrackingSeed(
    {
      accountId: account.id,
      broker: account.broker,
      brokerServer: account.brokerServer,
      initialBalance: account.initialBalance,
      liveBalance: account.liveBalance,
      liveEquity: account.liveEquity,
    },
    {
      phaseStartDate: account.propPhaseStartDate
        ? toDayKey(new Date(account.propPhaseStartDate))
        : null,
    }
  );

  const challengeStartBalance = resolvedSeed.startBalance;
  const challengeStartDate = new Date(resolvedSeed.phaseStartDate);

  if (challengeStartBalance <= 0) {
    return false;
  }

  const challengeStartDayKey = toDayKey(challengeStartDate);
  const [closedTradesRaw, challengeSnapshots] = await Promise.all([
    db.query.trade.findMany({
      where: and(
        eq(trade.accountId, accountId),
        gte(trade.closeTime, challengeStartDate)
      ),
    }),
    db.query.propDailySnapshot.findMany({
      where: and(
        eq(propDailySnapshot.accountId, accountId),
        gte(propDailySnapshot.date, challengeStartDayKey)
      ),
      columns: {
        breachedDailyLoss: true,
        breachedMaxLoss: true,
      },
      limit: 365,
    }),
  ]);

  if (
    challengeSnapshots.some(
      (snapshot) => snapshot.breachedDailyLoss || snapshot.breachedMaxLoss
    )
  ) {
    return false;
  }

  const closedTrades = [...closedTradesRaw].sort((left, right) => {
    const leftTime = left.closeTime?.getTime() ?? left.openTime?.getTime() ?? 0;
    const rightTime =
      right.closeTime?.getTime() ?? right.openTime?.getTime() ?? 0;
    return leftTime - rightTime;
  });

  const phaseMilestones: Array<{
    order: number;
    name: string;
    reachedOn: string;
    nextPhaseStartBalance: number;
  }> = [];
  let runningBalance = challengeStartBalance;
  let phaseStartBalance = challengeStartBalance;
  let phaseCursor = 0;

  const registerMilestone = (reachedOn: string) => {
    while (phaseCursor < challengePhases.length) {
      const phase = challengePhases[phaseCursor]!;
      const phaseTargetAbsolute = getPhaseTargetAbsolute(
        phase,
        phaseStartBalance
      );
      const nextPhaseStartBalance = phaseStartBalance + phaseTargetAbsolute;

      if (phaseTargetAbsolute <= 0 || runningBalance >= nextPhaseStartBalance) {
        phaseMilestones.push({
          order: phase.order,
          name: phase.name,
          reachedOn,
          nextPhaseStartBalance,
        });
        phaseStartBalance = nextPhaseStartBalance;
        phaseCursor += 1;
        continue;
      }

      break;
    }
  };

  for (const row of closedTrades) {
    runningBalance += getClosedTradeNetPnl(row);
    registerMilestone(
      getRealizationDayKey(row) || getTradingDayKey(row) || toDayKey(new Date())
    );
  }

  const currentBalance = toNumber(account.liveBalance, runningBalance);
  const currentEquity = toNumber(account.liveEquity, currentBalance);
  runningBalance = currentBalance;
  registerMilestone(toDayKey(new Date()));

  const currentPassedPhaseCount = getPassedPhaseCount(
    account.propCurrentPhase,
    challengePhases
  );
  const computedPassedPhaseCount = phaseMilestones.length;
  const desiredPhase =
    computedPassedPhaseCount >= challengePhases.length
      ? 0
      : challengePhases[computedPassedPhaseCount]?.order ?? 1;

  const priorMilestone =
    computedPassedPhaseCount > 0
      ? phaseMilestones[computedPassedPhaseCount - 1]!
      : null;
  const desiredStartBalance = priorMilestone
    ? priorMilestone.nextPhaseStartBalance
    : challengeStartBalance;
  const desiredStartDate = priorMilestone
    ? priorMilestone.reachedOn
    : resolvedSeed.phaseStartDate;

  const needsPhaseUpdate =
    desiredPhase !== (account.propCurrentPhase ?? 1) ||
    Math.abs(toNumber(account.propPhaseStartBalance) - desiredStartBalance) >
      0.01 ||
    (account.propPhaseStartDate
      ? toDayKey(new Date(account.propPhaseStartDate))
      : null) !== desiredStartDate;

  if (!needsPhaseUpdate || computedPassedPhaseCount < currentPassedPhaseCount) {
    return false;
  }

  const previousPhase = account.propCurrentPhase ?? 1;
  const previousPhaseLabel =
    challengePhases.find((phase) => phase.order === previousPhase)?.name ??
    null;
  const nextPhaseLabel =
    desiredPhase === 0
      ? "Funded"
      : challengePhases.find((phase) => phase.order === desiredPhase)?.name ??
        null;

  await db
    .update(tradingAccount)
    .set({
      propCurrentPhase: desiredPhase,
      propPhaseStartDate: desiredStartDate,
      propPhaseStartBalance: desiredStartBalance.toFixed(2),
      propPhaseStartEquity: Math.max(
        desiredStartBalance,
        currentEquity
      ).toFixed(2),
      propDailyHighWaterMark: Math.max(
        desiredStartBalance,
        currentEquity
      ).toFixed(2),
      propPhaseHighWaterMark: Math.max(
        desiredStartBalance,
        currentEquity
      ).toFixed(2),
      propPhaseCurrentProfit: "0",
      propPhaseCurrentProfitPercent: "0",
      propPhaseTradingDays: 0,
      propPhaseStatus: "active",
      propPhaseBestDayProfit: "0",
      propPhaseBestDayProfitPercent: "0",
      propIsCurrentChallengeStage: true,
    })
    .where(eq(tradingAccount.id, accountId));

  await recordPropChallengePhaseAdvance({
    accountId,
    previousPhase,
    nextPhase: desiredPhase,
    phaseStartedAt: desiredStartDate,
    startBalance: desiredStartBalance,
    startEquity: Math.max(desiredStartBalance, currentEquity),
    previousPhaseLabel,
    nextPhaseLabel,
  });

  const newlyPassedPhases = phaseMilestones.slice(currentPassedPhaseCount);
  const finalPhaseOrder = challengePhases[challengePhases.length - 1]?.order;

  for (const phase of newlyPassedPhases) {
    const reachedFunded = phase.order === finalPhaseOrder;
    const nextPhaseOrder = reachedFunded
      ? 0
      : challengePhases.find((candidate) => candidate.order > phase.order)
          ?.order ?? 0;
    await createNotification({
      userId: account.userId,
      accountId: account.id,
      type: "prop_phase_advanced",
      title: reachedFunded
        ? `🏆  ${account.name} passed ${phase.name}`
        : `${account.name} passed ${phase.name}`,
      body: reachedFunded
        ? `The account met the requirements for ${phase.name} and reached the funded stage.`
        : `The account met the requirements for ${phase.name} and advanced to the next stage.`,
      metadata: {
        propFirmId: account.propFirmId,
        challengeRuleId: account.propChallengeRuleId,
        phaseOrder: phase.order,
        nextPhase: nextPhaseOrder,
        theme: reachedFunded ? "gold" : null,
      },
      dedupeKey: `prop-phase-advanced:${account.id}:${phase.order}`,
    });
  }

  return true;
}

async function clearResolvedRecentBreachAlerts(
  accountId: string,
  result: RuleCheckResult
) {
  const hasCurrentCriticalBreach = result.alerts.some(
    (alert) =>
      alert.type === "breach" &&
      (alert.rule === "daily_loss" || alert.rule === "max_loss")
  );

  if (hasCurrentCriticalBreach) {
    return;
  }

  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
    columns: {
      propPhaseStartDate: true,
    },
  });

  const phaseStartDayKey = account?.propPhaseStartDate
    ? toDayKey(new Date(account.propPhaseStartDate))
    : null;

  if (phaseStartDayKey) {
    const phaseSnapshots = await db.query.propDailySnapshot.findMany({
      where: and(
        eq(propDailySnapshot.accountId, accountId),
        gte(propDailySnapshot.date, phaseStartDayKey)
      ),
      columns: {
        breachedDailyLoss: true,
        breachedMaxLoss: true,
      },
      limit: 90,
    });

    if (
      phaseSnapshots.some(
        (snapshot) => snapshot.breachedDailyLoss || snapshot.breachedMaxLoss
      )
    ) {
      return;
    }
  }

  const cleanupCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await db
    .delete(propAlert)
    .where(
      and(
        eq(propAlert.accountId, accountId),
        eq(propAlert.alertType, "breach"),
        gte(propAlert.createdAt, cleanupCutoff),
        or(eq(propAlert.rule, "daily_loss"), eq(propAlert.rule, "max_loss"))
      )
    );
}

/**
 * Check prop firm rules for an account
 * @param accountId - Trading account ID
 * @returns RuleCheckResult
 */
export async function checkPropRules(
  accountId: string,
  options: CheckPropRuleOptions = {}
): Promise<RuleCheckResult> {
  // Fetch account with prop firm data
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount || !account.propChallengeRuleId) {
    throw new Error("Account is not a prop account or missing challenge rules");
  }

  // Fetch challenge rules
  const challengeRule = await getChallengeRuleById(account.propChallengeRuleId);

  if (!challengeRule) {
    throw new Error("Challenge rules not found");
  }

  const phases = challengeRule.phases as any[];
  const currentPhase = phases.find((p) => p.order === account.propCurrentPhase);

  if (!currentPhase) {
    throw new Error("Current phase not found in challenge rules");
  }

  const rules: PropPhaseRules = currentPhase;
  const alerts: RuleCheckResult["alerts"] = [];
  const now = new Date();
  const todayKey = toDayKey(now);
  const phaseStartDate = account.propPhaseStartDate
    ? new Date(account.propPhaseStartDate)
    : new Date(0);
  const phaseStartDayKey = toDayKey(phaseStartDate);
  const phaseStartBalance = toNumber(
    account.propPhaseStartBalance ?? account.initialBalance
  );
  const phaseStartEquity = toNumber(
    account.propPhaseStartEquity ?? account.initialBalance ?? phaseStartBalance
  );
  const liveIsFresh =
    !!account.lastSyncedAt &&
    now.getTime() - account.lastSyncedAt.getTime() <= 15 * 60 * 1000;
  const storedLiveEquity = toNumber(account.liveEquity ?? account.liveBalance);
  const shouldUseStoredLiveState =
    account.liveBalance != null &&
    (liveIsFresh || (account.propCurrentPhase ?? 1) !== 1);
  const phaseOpenedAtCurrentState =
    (account.propCurrentPhase ?? 1) !== 1 &&
    account.liveBalance != null &&
    Math.abs(phaseStartEquity - storedLiveEquity) < 0.01;

  const [closedTradesRaw, openTrades, phaseSnapshots] = await Promise.all([
    db.query.trade.findMany({
      where: and(
        eq(trade.accountId, accountId),
        gte(trade.closeTime, phaseStartDate)
      ),
    }),
    db.query.openTrade.findMany({
      where: eq(openTrade.accountId, accountId),
    }),
    db.query.propDailySnapshot.findMany({
      where: and(
        eq(propDailySnapshot.accountId, accountId),
        gte(propDailySnapshot.date, phaseStartDayKey)
      ),
      orderBy: desc(propDailySnapshot.date),
      limit: 90,
    }),
  ]);

  const closedTrades = [...closedTradesRaw]
    .filter(
      (row) =>
        !phaseOpenedAtCurrentState ||
        getRealizationDayKey(row) !== phaseStartDayKey
    )
    .sort((left, right) => {
      const leftTime =
        left.closeTime?.getTime() ?? left.openTime?.getTime() ?? 0;
      const rightTime =
        right.closeTime?.getTime() ?? right.openTime?.getTime() ?? 0;
      return leftTime - rightTime;
    });

  const realizedProfit = closedTrades.reduce(
    (sum, row) => sum + getClosedTradeNetPnl(row),
    0
  );
  const floatingProfit = openTrades.reduce(
    (sum, row) => sum + getOpenTradeNetPnl(row),
    0
  );
  const derivedBalance = phaseStartBalance + realizedProfit;
  const currentBalance = shouldUseStoredLiveState
    ? toNumber(account.liveBalance, derivedBalance)
    : derivedBalance;
  const currentEquity =
    shouldUseStoredLiveState && account.liveEquity != null
      ? toNumber(account.liveEquity, currentBalance + floatingProfit)
      : currentBalance + floatingProfit;

  const currentProfit = currentBalance - phaseStartBalance;
  const currentProfitPercent =
    phaseStartBalance > 0 ? (currentProfit / phaseStartBalance) * 100 : 0;

  const tradingDayKeys = new Set<string>();
  const dailyProfitByDay = new Map<string, number>();

  for (const row of closedTrades) {
    const tradingDayKey = getTradingDayKey(row);
    const realizationDayKey = getRealizationDayKey(row);
    if (tradingDayKey) {
      tradingDayKeys.add(tradingDayKey);
    }
    if (realizationDayKey) {
      dailyProfitByDay.set(
        realizationDayKey,
        (dailyProfitByDay.get(realizationDayKey) || 0) +
          getClosedTradeNetPnl(row)
      );
    }
  }

  for (const row of openTrades) {
    const tradingDayKey = getTradingDayKey(row);
    if (tradingDayKey) {
      tradingDayKeys.add(tradingDayKey);
    }
  }

  const tradingDays = tradingDayKeys.size;
  const bestDayProfit = Math.max(0, ...dailyProfitByDay.values(), 0);
  const bestDayProfitPercent =
    phaseStartBalance > 0 ? (bestDayProfit / phaseStartBalance) * 100 : 0;

  let runningPhaseEquity = phaseStartEquity;
  let phasePeakEquity = phaseStartEquity;
  let maxDrawdownTaken = 0;
  let maxDrawdownTakenPercent = 0;

  for (const row of closedTrades) {
    runningPhaseEquity += getClosedTradeNetPnl(row);
    phasePeakEquity = Math.max(phasePeakEquity, runningPhaseEquity);
    const drawdown = Math.max(0, phasePeakEquity - runningPhaseEquity);
    const drawdownPercent =
      rules.maxLossType === "trailing"
        ? phasePeakEquity > 0
          ? (drawdown / phasePeakEquity) * 100
          : 0
        : phaseStartBalance > 0
        ? (drawdown / phaseStartBalance) * 100
        : 0;

    maxDrawdownTaken = Math.max(maxDrawdownTaken, drawdown);
    maxDrawdownTakenPercent = Math.max(
      maxDrawdownTakenPercent,
      drawdownPercent
    );
  }

  const priorSnapshot =
    phaseSnapshots.find((snapshot) => String(snapshot.date) < todayKey) || null;
  const realizedBeforeToday = Array.from(dailyProfitByDay.entries()).reduce(
    (sum, [dayKey, profit]) => (dayKey < todayKey ? sum + profit : sum),
    0
  );
  const todayStartingBalance = priorSnapshot
    ? toNumber(
        priorSnapshot.endingBalance,
        phaseStartBalance + realizedBeforeToday
      )
    : phaseStartBalance + realizedBeforeToday;
  const todayStartingEquity = priorSnapshot
    ? toNumber(priorSnapshot.endingEquity, todayStartingBalance)
    : todayStartingBalance;

  let runningTodayEquity = todayStartingEquity;
  let todayPeakEquity = todayStartingEquity;
  let dailyDrawdownTaken = 0;
  let dailyDrawdownTakenPercent = 0;

  for (const row of closedTrades) {
    const tradeDayKey = getRealizationDayKey(row);
    if (tradeDayKey !== todayKey) continue;

    runningTodayEquity += getClosedTradeNetPnl(row);
    todayPeakEquity = Math.max(todayPeakEquity, runningTodayEquity);
    const drawdown = Math.max(0, todayPeakEquity - runningTodayEquity);
    const drawdownPercent =
      phaseStartBalance > 0 ? (drawdown / phaseStartBalance) * 100 : 0;

    dailyDrawdownTaken = Math.max(dailyDrawdownTaken, drawdown);
    dailyDrawdownTakenPercent = Math.max(
      dailyDrawdownTakenPercent,
      drawdownPercent
    );
  }

  const storedDailyHighWaterMark =
    liveIsFresh &&
    account.lastSyncedAt &&
    toDayKey(account.lastSyncedAt) === todayKey
      ? toNumber(account.propDailyHighWaterMark)
      : 0;
  const dailyHighWaterMark = Math.max(
    todayPeakEquity,
    currentEquity,
    storedDailyHighWaterMark
  );
  const dailyDrawdown = Math.max(0, dailyHighWaterMark - currentEquity);
  const dailyDrawdownPercent =
    phaseStartBalance > 0 ? (dailyDrawdown / phaseStartBalance) * 100 : 0;
  dailyDrawdownTaken = Math.max(dailyDrawdownTaken, dailyDrawdown);
  dailyDrawdownTakenPercent = Math.max(
    dailyDrawdownTakenPercent,
    dailyDrawdownPercent
  );

  const storedPhaseHighWaterMark = toNumber(account.propPhaseHighWaterMark);
  const phaseHighWaterMark = Math.max(
    phasePeakEquity,
    currentEquity,
    storedPhaseHighWaterMark
  );
  const maxDrawdown = Math.max(0, phaseHighWaterMark - currentEquity);
  const maxDrawdownPercent =
    rules.maxLossType === "trailing"
      ? phaseHighWaterMark > 0
        ? (maxDrawdown / phaseHighWaterMark) * 100
        : 0
      : phaseStartBalance > 0
      ? (maxDrawdown / phaseStartBalance) * 100
      : 0;
  maxDrawdownTaken = Math.max(maxDrawdownTaken, maxDrawdown);
  maxDrawdownTakenPercent = Math.max(
    maxDrawdownTakenPercent,
    maxDrawdownPercent
  );

  // Days remaining (if time limit exists)
  let daysRemaining: number | null = null;
  if (rules.timeLimitDays && account.propPhaseStartDate) {
    const startDate = new Date(account.propPhaseStartDate);
    const daysPassed = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    daysRemaining = rules.timeLimitDays - daysPassed;
  }

  const thresholdMode =
    rules.profitTargetType === "absolute" ? "currency" : "percent";
  const dailyLossMode =
    rules.dailyLossLimitType === "absolute"
      ? "currency"
      : rules.dailyLossLimitType === "percentage"
        ? "percent"
        : thresholdMode;
  const dailyLossCurrentValue =
    dailyLossMode === "currency" ? dailyDrawdown : dailyDrawdownPercent;
  const dailyLossObservedValue =
    dailyLossMode === "currency"
      ? dailyDrawdownTaken
      : dailyDrawdownTakenPercent;
  const maxLossCurrentValue =
    thresholdMode === "currency" ? maxDrawdown : maxDrawdownPercent;
  const maxLossObservedValue =
    thresholdMode === "currency" ? maxDrawdownTaken : maxDrawdownTakenPercent;
  const previousSnapshotBreachedDailyLoss = phaseSnapshots.some(
    (snapshot) => snapshot.breachedDailyLoss
  );
  const previousSnapshotBreachedMaxLoss = phaseSnapshots.some(
    (snapshot) => snapshot.breachedMaxLoss
  );

  let passed = true;

  // ===== RULE 1: Daily Loss Limit =====
  const dailyLossBreached =
    rules.dailyLossLimit !== null &&
    (previousSnapshotBreachedDailyLoss ||
      dailyLossObservedValue > rules.dailyLossLimit);

  if (dailyLossBreached) {
    passed = false;
    alerts.push({
      type: "breach",
      severity: "critical",
      rule: "daily_loss",
      message: `BREACH: Daily loss limit exceeded (${formatMetricValue(
        dailyLossObservedValue,
        dailyLossMode
      )} / ${formatMetricValue(rules.dailyLossLimit!, dailyLossMode)})`,
      currentValue: dailyLossObservedValue,
      thresholdValue: rules.dailyLossLimit!,
    });
  } else if (
    rules.dailyLossLimit !== null &&
    dailyLossCurrentValue > rules.dailyLossLimit * 0.8
  ) {
    alerts.push({
      type: "warning",
      severity: "warning",
      rule: "daily_loss",
      message: `WARNING: Approaching daily loss limit (${formatMetricValue(
        dailyLossCurrentValue,
        dailyLossMode
      )} / ${formatMetricValue(rules.dailyLossLimit, dailyLossMode)})`,
      currentValue: dailyLossCurrentValue,
      thresholdValue: rules.dailyLossLimit,
    });
  }

  // ===== RULE 2: Max Loss (Absolute or Trailing) =====
  const maxLossBreached =
    rules.maxLoss !== null &&
    (previousSnapshotBreachedMaxLoss || maxLossObservedValue > rules.maxLoss);

  if (maxLossBreached) {
    passed = false;
    alerts.push({
      type: "breach",
      severity: "critical",
      rule: "max_loss",
      message: `BREACH: Maximum loss limit exceeded (${formatMetricValue(
        maxLossObservedValue,
        thresholdMode
      )} / ${formatMetricValue(rules.maxLoss!, thresholdMode)})`,
      currentValue: maxLossObservedValue,
      thresholdValue: rules.maxLoss!,
    });
  } else if (
    rules.maxLoss !== null &&
    maxLossCurrentValue > rules.maxLoss * 0.8
  ) {
    alerts.push({
      type: "warning",
      severity: "warning",
      rule: "max_loss",
      message: `WARNING: Approaching max loss limit (${formatMetricValue(
        maxLossCurrentValue,
        thresholdMode
      )} / ${formatMetricValue(rules.maxLoss, thresholdMode)})`,
      currentValue: maxLossCurrentValue,
      thresholdValue: rules.maxLoss,
    });
  }

  // ===== RULE 3: Profit Target =====
  if (rules.profitTarget !== null) {
    const targetValue =
      rules.profitTargetType === "percentage"
        ? rules.profitTarget
        : rules.profitTarget;
    const currentValue =
      rules.profitTargetType === "percentage"
        ? currentProfitPercent
        : currentProfit;

    if (currentValue >= targetValue && tradingDays >= rules.minTradingDays) {
      alerts.push({
        type: "milestone",
        severity: "info",
        rule: "profit_target",
        message: `PASSED: Profit target achieved (${currentValue.toFixed(
          2
        )} / ${targetValue})`,
        currentValue,
        thresholdValue: targetValue,
      });
    } else if (currentValue >= targetValue * 0.9) {
      alerts.push({
        type: "milestone",
        severity: "info",
        rule: "profit_target_90pct",
        message: `90% of the target is on the board (${formatMetricValue(
          currentValue,
          thresholdMode
        )} / ${formatMetricValue(
          targetValue,
          thresholdMode
        )}). Stay focused and finish the phase cleanly.`,
        currentValue,
        thresholdValue: targetValue,
      });
    } else if (currentValue >= targetValue * 0.75) {
      alerts.push({
        type: "milestone",
        severity: "info",
        rule: "profit_target_75pct",
        message: `75% of the target is complete (${formatMetricValue(
          currentValue,
          thresholdMode
        )} / ${formatMetricValue(
          targetValue,
          thresholdMode
        )}). You're close, but you have not crossed the finish line yet. Stay focused.`,
        currentValue,
        thresholdValue: targetValue,
      });
    } else if (currentValue >= targetValue * 0.5) {
      alerts.push({
        type: "milestone",
        severity: "info",
        rule: "profit_target_50pct",
        message: `50% of the target is complete (${formatMetricValue(
          currentValue,
          thresholdMode
        )} / ${formatMetricValue(
          targetValue,
          thresholdMode
        )}). Good progress, but the finish line still needs disciplined execution.`,
        currentValue,
        thresholdValue: targetValue,
      });
    }
  }

  // ===== RULE 4: Minimum trading days =====
  if (rules.minTradingDays > 0 && tradingDays < rules.minTradingDays) {
    alerts.push({
      type: "warning",
      severity: "info",
      rule: "min_trading_days",
      message: `${tradingDays} / ${rules.minTradingDays} minimum trading days completed`,
      currentValue: tradingDays,
      thresholdValue: rules.minTradingDays,
    });
  } else if (rules.minTradingDays > 0) {
    alerts.push({
      type: "milestone",
      severity: "info",
      rule: "min_trading_days_complete",
      message: `PASSED: Minimum trading days completed (${tradingDays} / ${rules.minTradingDays})`,
      currentValue: tradingDays,
      thresholdValue: rules.minTradingDays,
    });
  }

  // ===== RULE 5: Consistency Rule (E8 Markets) =====
  if (rules.consistencyRule !== null && bestDayProfitPercent > 0) {
    const bestDayRatio =
      currentProfit > 0 ? (bestDayProfit / currentProfit) * 100 : 0;
    if (bestDayRatio > rules.consistencyRule) {
      passed = false;
      alerts.push({
        type: "breach",
        severity: "critical",
        rule: "consistency",
        message: `BREACH: Best day exceeds ${
          rules.consistencyRule
        }% of total profit (${bestDayRatio.toFixed(2)}%)`,
        currentValue: bestDayRatio,
        thresholdValue: rules.consistencyRule,
      });
    } else if (bestDayRatio > rules.consistencyRule * 0.9) {
      alerts.push({
        type: "warning",
        severity: "warning",
        rule: "consistency",
        message: `WARNING: Best day approaching consistency limit (${bestDayRatio.toFixed(
          2
        )}% / ${rules.consistencyRule}%)`,
        currentValue: bestDayRatio,
        thresholdValue: rules.consistencyRule,
      });
    }
  }

  // ===== RULE 6: Time Limit =====
  const timeLimitTargetValue =
    rules.profitTargetType === "absolute"
      ? currentProfit
      : currentProfitPercent;

  if (
    daysRemaining !== null &&
    daysRemaining < 0 &&
    rules.profitTarget !== null &&
    timeLimitTargetValue < rules.profitTarget
  ) {
    passed = false;
    alerts.push({
      type: "breach",
      severity: "critical",
      rule: "time_limit",
      message: `BREACH: Time limit exceeded (${rules.timeLimitDays} days)`,
      currentValue: 0,
      thresholdValue: rules.timeLimitDays!,
    });
  } else if (daysRemaining !== null && daysRemaining <= 7) {
    alerts.push({
      type: "warning",
      severity: "warning",
      rule: "time_limit",
      message: `WARNING: ${daysRemaining} days remaining`,
      currentValue: daysRemaining,
      thresholdValue: rules.timeLimitDays!,
    });
  }

  const targetBasisValue =
    rules.profitTargetType === "absolute"
      ? currentProfit
      : currentProfitPercent;
  const targetMet =
    rules.profitTarget !== null
      ? targetBasisValue >= rules.profitTarget
      : false;
  const minTradingDaysMet = tradingDays >= rules.minTradingDays;
  if (account.propPhaseStatus === "failed") {
    passed = false;
  }
  const phaseStatus: PropPhaseStatus =
    account.propPhaseStatus === "paused"
      ? "paused"
      : account.propPhaseStatus === "failed"
      ? "failed"
      : !passed
      ? "failed"
      : rules.profitTarget !== null && targetMet && minTradingDaysMet
      ? "passed"
      : "active";

  if (options.persist) {
    await db
      .update(tradingAccount)
      .set({
        propDailyHighWaterMark: toFixedMetric(dailyHighWaterMark),
        propPhaseHighWaterMark: toFixedMetric(phaseHighWaterMark),
        propPhaseCurrentProfit: toFixedMetric(currentProfit),
        propPhaseCurrentProfitPercent: toFixedMetric(currentProfitPercent),
        propPhaseTradingDays: tradingDays,
        propPhaseStatus: phaseStatus,
        propPhaseBestDayProfit: toFixedMetric(bestDayProfit),
        propPhaseBestDayProfitPercent: toFixedMetric(bestDayProfitPercent),
      })
      .where(eq(tradingAccount.id, accountId));

    await syncPropChallengeOutcomeForAccount({
      accountId,
      phaseStatus,
    });

    if (options.saveAlerts && alerts.length > 0) {
      await saveAlerts(accountId, alerts);
    }
  }

  return {
    passed,
    phaseStatus,
    alerts,
    metrics: {
      currentBalance,
      currentEquity,
      dailyHighWaterMark,
      phaseHighWaterMark,
      currentProfit,
      currentProfitPercent,
      dailyDrawdown,
      dailyDrawdownPercent,
      maxDrawdown,
      maxDrawdownPercent,
      maxDrawdownTaken,
      maxDrawdownTakenPercent,
      tradingDays,
      daysRemaining,
      bestDayProfit,
      bestDayProfitPercent,
    },
    completion: {
      targetMet,
      minTradingDaysMet,
    },
  };
}

export async function syncPropAccountState(
  accountId: string,
  options: Omit<CheckPropRuleOptions, "persist"> = {}
) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
    columns: {
      id: true,
      isPropAccount: true,
      propChallengeRuleId: true,
      propChallengeInstanceId: true,
      propIsCurrentChallengeStage: true,
    },
  });

  if (!account || !account.isPropAccount || !account.propChallengeRuleId) {
    return null;
  }

  if (
    account.propChallengeInstanceId &&
    account.propIsCurrentChallengeStage === false
  ) {
    return null;
  }

  await ensurePropChallengeLineageForAccount(accountId);

  await repairPropTrackingBaselineIfNeeded(accountId);
  await repairPropPhaseMetricsIfNeeded(accountId);
  const preflightRuleCheck = await checkPropRules(accountId, {
    persist: true,
    saveAlerts: false,
  });

  if (preflightRuleCheck.passed) {
    await syncPropPhaseAdvancementIfNeeded(accountId);
  }

  const result = await checkPropRules(accountId, {
    persist: true,
    saveAlerts: false,
  });

  await clearResolvedRecentBreachAlerts(accountId, result);

  if (options.saveAlerts && result.alerts.length > 0) {
    await saveAlerts(accountId, result.alerts);
  }

  return result;
}

/**
 * Save alerts to the database
 */
export async function saveAlerts(
  accountId: string,
  alerts: RuleCheckResult["alerts"]
) {
  const [recentAlerts, account] = await Promise.all([
    db.query.propAlert.findMany({
      where: eq(propAlert.accountId, accountId),
      orderBy: desc(propAlert.createdAt),
      limit: 50,
    }),
    db.query.tradingAccount.findFirst({
      where: eq(tradingAccount.id, accountId),
      columns: {
        id: true,
        userId: true,
        name: true,
        propCurrentPhase: true,
        propPhaseStartDate: true,
      },
    }),
  ]);

  if (!account) {
    return;
  }

  for (const alert of alerts) {
    const duplicate = recentAlerts.some((existing) => {
      const createdAt = existing.createdAt?.getTime() || 0;
      return (
        existing.alertType === alert.type &&
        existing.severity === alert.severity &&
        existing.rule === alert.rule &&
        existing.message === alert.message &&
        Date.now() - createdAt < 12 * 60 * 60 * 1000
      );
    });

    if (duplicate) continue;

    await db.insert(propAlert).values({
      id: crypto.randomUUID(),
      accountId,
      alertType: alert.type,
      severity: alert.severity,
      rule: alert.rule,
      message: alert.message,
      currentValue: alert.currentValue.toString(),
      thresholdValue: alert.thresholdValue.toString(),
      acknowledged: false,
    });

    const notification = buildPropAlertNotification(account, alert);
    if (notification) {
      await createNotification(notification);
    }
  }
}

/**
 * Update daily high water mark (should be called on every tick/update)
 */
export async function updateDailyHighWaterMark(
  accountId: string,
  currentEquity: number
) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount) return;

  const currentHWM = parseFloat(
    account.propDailyHighWaterMark?.toString() || "0"
  );

  if (currentEquity > currentHWM) {
    await db
      .update(tradingAccount)
      .set({ propDailyHighWaterMark: currentEquity.toString() })
      .where(eq(tradingAccount.id, accountId));
  }
}

/**
 * Update phase high water mark (should be called on every tick/update)
 */
export async function updatePhaseHighWaterMark(
  accountId: string,
  currentEquity: number
) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount) return;

  const currentHWM = parseFloat(
    account.propPhaseHighWaterMark?.toString() || "0"
  );

  if (currentEquity > currentHWM) {
    await db
      .update(tradingAccount)
      .set({ propPhaseHighWaterMark: currentEquity.toString() })
      .where(eq(tradingAccount.id, accountId));
  }
}

/**
 * Reset daily high water mark (should be called at midnight UTC/server time)
 */
export async function resetDailyHighWaterMark(accountId: string) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount) return;

  const currentEquity = parseFloat(
    account.liveEquity?.toString() || account.liveBalance?.toString() || "0"
  );

  await db
    .update(tradingAccount)
    .set({ propDailyHighWaterMark: currentEquity.toString() })
    .where(eq(tradingAccount.id, accountId));
}

/**
 * Create daily snapshot for prop account
 * Should be called at end of day
 */
export async function createDailySnapshot(accountId: string, date: Date) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount) return;

  // Get previous day's snapshot
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);

  const prevSnapshot = await db.query.propDailySnapshot.findFirst({
    where: and(
      eq(propDailySnapshot.accountId, accountId),
      eq(propDailySnapshot.date, yesterday.toISOString().split("T")[0])
    ),
  });

  const startingBalance = parseFloat(
    prevSnapshot?.endingBalance?.toString() ||
      account.propPhaseStartBalance?.toString() ||
      "0"
  );
  const startingEquity = parseFloat(
    prevSnapshot?.endingEquity?.toString() ||
      account.propPhaseStartEquity?.toString() ||
      "0"
  );
  const endingBalance = parseFloat(account.liveBalance?.toString() || "0");
  const endingEquity = parseFloat(account.liveEquity?.toString() || "0");

  const dailyProfit = endingBalance - startingBalance;
  const dailyProfitPercent = (dailyProfit / startingBalance) * 100;

  // Count trades for the day
  const tradesCount = await db
    .select({ count: sql`count(*)` })
    .from(trade)
    .where(
      and(
        eq(trade.accountId, accountId),
        gte(trade.openTime, date),
        sql`${trade.openTime} < ${new Date(
          date.getTime() + 24 * 60 * 60 * 1000
        )}`
      )
    );

  const isTradingDay = parseInt(tradesCount[0].count as string) > 0;

  // Check for rule breaches
  const ruleCheck = await checkPropRules(accountId);

  await db.insert(propDailySnapshot).values({
    id: crypto.randomUUID(),
    accountId,
    date: date.toISOString().split("T")[0],
    startingBalance: startingBalance.toString(),
    startingEquity: startingEquity.toString(),
    endingBalance: endingBalance.toString(),
    endingEquity: endingEquity.toString(),
    dailyProfit: dailyProfit.toString(),
    dailyProfitPercent: dailyProfitPercent.toString(),
    dailyHighWaterMark:
      account.propDailyHighWaterMark?.toString() || endingEquity.toString(),
    dailyDrawdown: ruleCheck.metrics.dailyDrawdown.toString(),
    dailyDrawdownPercent: ruleCheck.metrics.dailyDrawdownPercent.toString(),
    tradesCount: parseInt(tradesCount[0].count as string),
    isTradingDay,
    breachedDailyLoss: ruleCheck.alerts.some(
      (a) => a.rule === "daily_loss" && a.type === "breach"
    ),
    breachedMaxLoss: ruleCheck.alerts.some(
      (a) => a.rule === "max_loss" && a.type === "breach"
    ),
  });
}
