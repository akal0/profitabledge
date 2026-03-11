import { db } from "../db";
import { tradingAccount, propAlert, propDailySnapshot, trade } from "../db/schema/trading";
import { eq, and, gte, desc, sql } from "drizzle-orm";

/**
 * Prop Firm Rule Monitoring Library
 * Monitors prop firm challenge rules and generates alerts
 */

export interface PropPhaseRules {
  profitTarget: number | null;
  profitTargetType: "percentage" | "absolute";
  dailyLossLimit: number | null;
  maxLoss: number | null;
  maxLossType: "trailing" | "absolute";
  timeLimitDays: number | null;
  minTradingDays: number;
  consistencyRule: number | null;
  customRules?: Record<string, any>;
}

export interface RuleCheckResult {
  passed: boolean;
  alerts: Array<{
    type: "warning" | "breach" | "milestone";
    severity: "info" | "warning" | "critical";
    rule: string;
    message: string;
    currentValue: number;
    thresholdValue: number;
  }>;
  metrics: {
    currentProfit: number;
    currentProfitPercent: number;
    dailyDrawdown: number;
    dailyDrawdownPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    tradingDays: number;
    daysRemaining: number | null;
    bestDayProfit: number;
    bestDayProfitPercent: number;
  };
}

/**
 * Check prop firm rules for an account
 * @param accountId - Trading account ID
 * @returns RuleCheckResult
 */
export async function checkPropRules(accountId: string): Promise<RuleCheckResult> {
  // Fetch account with prop firm data
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount || !account.propChallengeRuleId) {
    throw new Error("Account is not a prop account or missing challenge rules");
  }

  // Fetch challenge rules
  const challengeRule = await db.query.propChallengeRule.findFirst({
    where: (propChallengeRule, { eq }) => eq(propChallengeRule.id, account.propChallengeRuleId!),
  });

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

  // Calculate current metrics
  // Use live balance if available and verified, otherwise calculate from trades
  let currentBalance = parseFloat(account.liveBalance?.toString() || "0");
  let currentEquity = parseFloat(account.liveEquity?.toString() || "0");

  const phaseStartBalance = parseFloat(account.propPhaseStartBalance?.toString() || account.initialBalance?.toString() || "0");
  const phaseStartEquity = parseFloat(account.propPhaseStartEquity?.toString() || account.initialBalance?.toString() || "0");

  // If no live balance, calculate from phase start + all trades since phase started
  if (!account.isVerified || !currentBalance) {
    const phaseStartDate = account.propPhaseStartDate ? new Date(account.propPhaseStartDate) : new Date(0);

    // Get all trades since phase started
    const trades = await db.query.trade.findMany({
      where: and(
        eq(trade.accountId, accountId),
        gte(trade.closeTime, phaseStartDate)
      ),
    });

    const totalProfit = trades.reduce((sum, t) => {
      const profit = parseFloat(t.profit?.toString() || "0");
      const commission = parseFloat(t.commission?.toString() || "0");
      const swap = parseFloat(t.swap?.toString() || "0");
      return sum + profit + commission + swap;
    }, 0);

    currentBalance = phaseStartBalance + totalProfit;
    currentEquity = currentBalance; // Assuming no open trades for equity calculation
  }

  const currentProfit = currentBalance - phaseStartBalance;
  const currentProfitPercent = phaseStartBalance > 0 ? (currentProfit / phaseStartBalance) * 100 : 0;

  // Daily high water mark for trailing daily loss
  const dailyHighWaterMark = parseFloat(account.propDailyHighWaterMark?.toString() || currentEquity.toString());
  const dailyDrawdown = Math.max(0, dailyHighWaterMark - currentEquity);
  const dailyDrawdownPercent = phaseStartBalance > 0 ? (dailyDrawdown / phaseStartBalance) * 100 : 0;

  // Phase high water mark for max drawdown
  const phaseHighWaterMark = parseFloat(
    account.propPhaseHighWaterMark?.toString() || phaseStartEquity.toString()
  );
  const maxDrawdown = Math.max(0, phaseHighWaterMark - currentEquity);
  const maxDrawdownPercent = rules.maxLossType === "trailing"
    ? phaseHighWaterMark > 0 ? (maxDrawdown / phaseHighWaterMark) * 100 : 0
    : phaseStartBalance > 0 ? (maxDrawdown / phaseStartBalance) * 100 : 0;

  // Calculate trading days from actual trades
  let tradingDays = 0;
  if (account.propPhaseStartDate) {
    const phaseStartDate = new Date(account.propPhaseStartDate);

    // Get all trades since phase started
    const trades = await db.query.trade.findMany({
      where: and(
        eq(trade.accountId, accountId),
        gte(trade.closeTime, phaseStartDate)
      ),
    });

    // Count unique days with trades
    const tradingDaysSet = new Set<string>();
    trades.forEach(t => {
      if (t.closeTime) {
        const dateStr = t.closeTime.toISOString().split('T')[0];
        tradingDaysSet.add(dateStr);
      }
    });
    tradingDays = tradingDaysSet.size;
  }

  // Best day profit (for consistency rule)
  const bestDayProfit = parseFloat(account.propPhaseBestDayProfit?.toString() || "0");
  const bestDayProfitPercent = parseFloat(account.propPhaseBestDayProfitPercent?.toString() || "0");

  // Days remaining (if time limit exists)
  let daysRemaining: number | null = null;
  if (rules.timeLimitDays && account.propPhaseStartDate) {
    const startDate = new Date(account.propPhaseStartDate);
    const today = new Date();
    const daysPassed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = rules.timeLimitDays - daysPassed;
  }

  let passed = true;

  // ===== RULE 1: Daily Loss Limit =====
  if (rules.dailyLossLimit !== null && dailyDrawdownPercent > rules.dailyLossLimit) {
    passed = false;
    alerts.push({
      type: "breach",
      severity: "critical",
      rule: "daily_loss",
      message: `BREACH: Daily loss limit exceeded (${dailyDrawdownPercent.toFixed(2)}% / ${rules.dailyLossLimit}%)`,
      currentValue: dailyDrawdownPercent,
      thresholdValue: rules.dailyLossLimit,
    });
  } else if (rules.dailyLossLimit !== null && dailyDrawdownPercent > rules.dailyLossLimit * 0.8) {
    alerts.push({
      type: "warning",
      severity: "warning",
      rule: "daily_loss",
      message: `WARNING: Approaching daily loss limit (${dailyDrawdownPercent.toFixed(2)}% / ${rules.dailyLossLimit}%)`,
      currentValue: dailyDrawdownPercent,
      thresholdValue: rules.dailyLossLimit,
    });
  }

  // ===== RULE 2: Max Loss (Absolute or Trailing) =====
  if (rules.maxLoss !== null && maxDrawdownPercent > rules.maxLoss) {
    passed = false;
    alerts.push({
      type: "breach",
      severity: "critical",
      rule: "max_loss",
      message: `BREACH: Maximum loss limit exceeded (${maxDrawdownPercent.toFixed(2)}% / ${rules.maxLoss}%)`,
      currentValue: maxDrawdownPercent,
      thresholdValue: rules.maxLoss,
    });
  } else if (rules.maxLoss !== null && maxDrawdownPercent > rules.maxLoss * 0.8) {
    alerts.push({
      type: "warning",
      severity: "warning",
      rule: "max_loss",
      message: `WARNING: Approaching max loss limit (${maxDrawdownPercent.toFixed(2)}% / ${rules.maxLoss}%)`,
      currentValue: maxDrawdownPercent,
      thresholdValue: rules.maxLoss,
    });
  }

  // ===== RULE 3: Profit Target =====
  if (rules.profitTarget !== null) {
    const targetValue = rules.profitTargetType === "percentage" ? rules.profitTarget : rules.profitTarget;
    const currentValue = rules.profitTargetType === "percentage" ? currentProfitPercent : currentProfit;

    if (currentValue >= targetValue && tradingDays >= rules.minTradingDays) {
      alerts.push({
        type: "milestone",
        severity: "info",
        rule: "profit_target",
        message: `PASSED: Profit target achieved (${currentValue.toFixed(2)} / ${targetValue})`,
        currentValue,
        thresholdValue: targetValue,
      });
    } else if (currentValue >= targetValue * 0.9) {
      alerts.push({
        type: "milestone",
        severity: "info",
        rule: "profit_target",
        message: `90% of profit target reached (${currentValue.toFixed(2)} / ${targetValue})`,
        currentValue,
        thresholdValue: targetValue,
      });
    }
  }

  // ===== RULE 4: Minimum Trading Days =====
  if (rules.minTradingDays > 0 && tradingDays < rules.minTradingDays) {
    alerts.push({
      type: "warning",
      severity: "info",
      rule: "min_trading_days",
      message: `${tradingDays} / ${rules.minTradingDays} minimum trading days completed`,
      currentValue: tradingDays,
      thresholdValue: rules.minTradingDays,
    });
  }

  // ===== RULE 5: Consistency Rule (E8 Markets) =====
  if (rules.consistencyRule !== null && bestDayProfitPercent > 0) {
    const bestDayRatio = (bestDayProfit / currentProfit) * 100;
    if (bestDayRatio > rules.consistencyRule) {
      passed = false;
      alerts.push({
        type: "breach",
        severity: "critical",
        rule: "consistency",
        message: `BREACH: Best day exceeds ${rules.consistencyRule}% of total profit (${bestDayRatio.toFixed(2)}%)`,
        currentValue: bestDayRatio,
        thresholdValue: rules.consistencyRule,
      });
    } else if (bestDayRatio > rules.consistencyRule * 0.9) {
      alerts.push({
        type: "warning",
        severity: "warning",
        rule: "consistency",
        message: `WARNING: Best day approaching consistency limit (${bestDayRatio.toFixed(2)}% / ${rules.consistencyRule}%)`,
        currentValue: bestDayRatio,
        thresholdValue: rules.consistencyRule,
      });
    }
  }

  // ===== RULE 6: Time Limit =====
  if (daysRemaining !== null && daysRemaining <= 0) {
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

  return {
    passed,
    alerts,
    metrics: {
      currentProfit,
      currentProfitPercent,
      dailyDrawdown,
      dailyDrawdownPercent,
      maxDrawdown,
      maxDrawdownPercent,
      tradingDays,
      daysRemaining,
      bestDayProfit,
      bestDayProfitPercent,
    },
  };
}

/**
 * Save alerts to the database
 */
export async function saveAlerts(accountId: string, alerts: RuleCheckResult["alerts"]) {
  for (const alert of alerts) {
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
  }
}

/**
 * Update daily high water mark (should be called on every tick/update)
 */
export async function updateDailyHighWaterMark(accountId: string, currentEquity: number) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount) return;

  const currentHWM = parseFloat(account.propDailyHighWaterMark?.toString() || "0");

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
export async function updatePhaseHighWaterMark(accountId: string, currentEquity: number) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (!account || !account.isPropAccount) return;

  const currentHWM = parseFloat(account.propPhaseHighWaterMark?.toString() || "0");

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

  const currentEquity = parseFloat(account.liveEquity?.toString() || account.liveBalance?.toString() || "0");

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
    prevSnapshot?.endingBalance?.toString() || account.propPhaseStartBalance?.toString() || "0"
  );
  const startingEquity = parseFloat(
    prevSnapshot?.endingEquity?.toString() || account.propPhaseStartEquity?.toString() || "0"
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
        sql`${trade.openTime} < ${new Date(date.getTime() + 24 * 60 * 60 * 1000)}`
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
    dailyHighWaterMark: account.propDailyHighWaterMark?.toString() || endingEquity.toString(),
    dailyDrawdown: ruleCheck.metrics.dailyDrawdown.toString(),
    dailyDrawdownPercent: ruleCheck.metrics.dailyDrawdownPercent.toString(),
    tradesCount: parseInt(tradesCount[0].count as string),
    isTradingDay,
    breachedDailyLoss: ruleCheck.alerts.some((a) => a.rule === "daily_loss" && a.type === "breach"),
    breachedMaxLoss: ruleCheck.alerts.some((a) => a.rule === "max_loss" && a.type === "breach"),
  });
}
