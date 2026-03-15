import { openTrade, trade } from "../db/schema/trading";

export type PropRuleAlert = {
  type: "warning" | "breach" | "milestone";
  severity: "info" | "warning" | "critical";
  rule: string;
  message: string;
  currentValue: number;
  thresholdValue: number;
};

export type PropAlertNotificationAccount = {
  id: string;
  userId: string;
  name: string;
  propCurrentPhase: number | null;
  propPhaseStartDate: string | null;
};

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toFixedMetric(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function formatMetricValue(value: number, mode: "currency" | "percent") {
  return mode === "currency" ? `$${value.toFixed(2)}` : `${value.toFixed(2)}%`;
}

export function formatPropRuleLabel(rule: string) {
  switch (rule) {
    case "daily_loss":
      return "Daily DD";
    case "max_loss":
      return "Max DD";
    case "profit_target":
      return "Profit Target";
    case "min_trading_days":
    case "min_trading_days_complete":
      return "Minimum trading days";
    case "time_limit":
      return "Time Limit";
    case "consistency":
      return "Consistency";
    default:
      return rule.replace(/_/g, " ");
  }
}

export function buildPropAlertNotification(
  account: PropAlertNotificationAccount,
  alert: PropRuleAlert
) {
  const phaseKey = `${account.propCurrentPhase ?? "na"}:${
    account.propPhaseStartDate ?? "na"
  }`;

  if (alert.type === "warning" || alert.type === "breach") {
    const isBreach = alert.type === "breach";
    return {
      userId: account.userId,
      accountId: account.id,
      type: "prop_violation" as const,
      title: isBreach
        ? `${account.name} breached ${formatPropRuleLabel(alert.rule)}`
        : `${account.name} warning: ${formatPropRuleLabel(alert.rule)}`,
      body: alert.message,
      metadata: {
        accountId: account.id,
        rule: alert.rule,
        severity: alert.severity,
        alertType: alert.type,
        currentValue: alert.currentValue,
        thresholdValue: alert.thresholdValue,
      },
      dedupeKey: `prop-notification:${account.id}:${phaseKey}:${alert.type}:${alert.rule}`,
    };
  }

  if (alert.type === "milestone") {
    if (alert.rule === "profit_target") {
      return null;
    }

    return {
      userId: account.userId,
      accountId: account.id,
      type: "prop_journey" as const,
      title:
        alert.rule === "min_trading_days_complete"
          ? `${account.name} completed minimum trading days`
          : alert.rule === "profit_target_50pct"
          ? `${account.name} reached 50% of target`
          : alert.rule === "profit_target_75pct"
          ? `${account.name} reached 75% of target`
          : alert.rule === "profit_target_90pct"
          ? `${account.name} is 90% to target`
          : `${account.name} milestone reached`,
      body: alert.message,
      metadata: {
        accountId: account.id,
        rule: alert.rule,
        severity: alert.severity,
        alertType: alert.type,
        currentValue: alert.currentValue,
        thresholdValue: alert.thresholdValue,
      },
      dedupeKey: `prop-notification:${account.id}:${phaseKey}:milestone:${alert.rule}`,
    };
  }

  return null;
}

export function toDayKey(value: Date) {
  return value.toISOString().split("T")[0];
}

export function getClosedTradeNetPnl(row: typeof trade.$inferSelect) {
  return toNumber(row.profit) + toNumber(row.commissions) + toNumber(row.swap);
}

export function getOpenTradeNetPnl(row: typeof openTrade.$inferSelect) {
  return toNumber(row.profit) + toNumber(row.commission) + toNumber(row.swap);
}

export function getTradingDayKey(
  row: typeof trade.$inferSelect | typeof openTrade.$inferSelect | null
) {
  if (!row) return null;
  const maybeOpenTime = "openTime" in row ? row.openTime : null;
  const maybeCloseTime = "closeTime" in row ? row.closeTime : null;
  const sourceDate = maybeOpenTime || maybeCloseTime;
  return sourceDate ? toDayKey(sourceDate) : null;
}

export function getRealizationDayKey(row: typeof trade.$inferSelect | null) {
  if (!row) return null;
  const sourceDate = row.closeTime || row.openTime;
  return sourceDate ? toDayKey(sourceDate) : null;
}

export function getPhaseTargetAbsolute(
  phase: {
    profitTarget: number | null;
    profitTargetType: "percentage" | "absolute";
  },
  phaseStartBalance: number
) {
  if (phase.profitTarget == null) return 0;
  if (phase.profitTargetType === "absolute") {
    return phase.profitTarget;
  }

  return (phaseStartBalance * phase.profitTarget) / 100;
}

export function getPassedPhaseCount(
  currentPhase: number | null | undefined,
  challengePhases: Array<{ order: number }>
) {
  if (currentPhase === 0) {
    return challengePhases.length;
  }

  const currentIndex = challengePhases.findIndex(
    (phase) => phase.order === currentPhase
  );

  return currentIndex === -1 ? 0 : currentIndex;
}
