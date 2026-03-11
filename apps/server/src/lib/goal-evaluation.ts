import { db } from "../db";
import { trade as tradeTable } from "../db/schema/trading";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { CustomGoalCriteria, GoalFilter } from "../types/custom-goals";

interface Trade {
  id: string;
  accountId: string;
  profit: string | null;
  openTime: Date | null;
  closeTime: Date | null;
  symbol: string | null;
  tradeType: string | null;
  // Add more fields as needed
}

/**
 * Evaluate a custom goal's current progress based on its criteria and filters
 */
export async function evaluateCustomGoal(
  accountId: string,
  criteria: CustomGoalCriteria,
  startDate: string,
  endDate?: string
): Promise<number> {
  // Build query with filters
  const conditions = [eq(tradeTable.accountId, accountId)];

  // Add date range filter
  if (startDate) {
    conditions.push(gte(tradeTable.closeTime, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(tradeTable.closeTime, new Date(endDate)));
  }

  // Apply custom filters
  for (const filter of criteria.filters) {
    const condition = buildFilterCondition(filter);
    if (condition) {
      conditions.push(condition);
    }
  }

  // Fetch filtered trades
  const trades = await db
    .select()
    .from(tradeTable)
    .where(and(...conditions));

  // Calculate the metric
  const metricValue = calculateMetric(trades as any, criteria.metric);

  return metricValue;
}

/**
 * Build a SQL condition from a goal filter
 */
function buildFilterCondition(filter: GoalFilter): any {
  const { type, value, operator = "is" } = filter;

  switch (type) {
    case "session":
      // Assuming you have a session tag column or function
      // This would need to be adapted to your schema
      return sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${tradeTable.id}::jsonb) AS tag
        WHERE tag->>'type' = 'session' AND tag->>'value' = ${value}
      )`;

    case "model":
      // Similar for model tags
      return sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${tradeTable.id}::jsonb) AS tag
        WHERE tag->>'type' = 'model' AND tag->>'value' = ${value}
      )`;

    case "symbol":
      if (operator === "is") {
        return eq(tradeTable.symbol, value as string);
      }
      break;

    case "direction":
      if (operator === "is") {
        return eq(tradeTable.tradeType, value as string);
      }
      break;

    case "day":
      // Filter by day of week
      if (operator === "is") {
        const dayMap: Record<string, number> = {
          sunday: 0,
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
        };
        const dayNum = dayMap[value as string];
        return sql`EXTRACT(DOW FROM ${tradeTable.openTime}) = ${dayNum}`;
      }
      break;

    default:
      return null;
  }

  return null;
}

/**
 * Calculate a metric from a set of trades
 */
function calculateMetric(trades: any[], metric: string): number {
  if (trades.length === 0) return 0;

  switch (metric) {
    case "winRate": {
      const winningTrades = trades.filter(
        (t) => parseFloat(t.profit || "0") > 0
      );
      return (winningTrades.length / trades.length) * 100;
    }

    case "profit": {
      return trades.reduce(
        (sum, t) => sum + parseFloat(t.profit || "0"),
        0
      );
    }

    case "avgRR": {
      const tradesWithRR = trades.filter(
        (t) => t.stopLoss && t.openPrice && t.profit
      );
      if (tradesWithRR.length === 0) return 0;

      const rrSum = tradesWithRR.reduce((sum, t) => {
        const risk = Math.abs(
          parseFloat(t.openPrice) - parseFloat(t.stopLoss)
        );
        const reward = parseFloat(t.profit);
        return sum + Math.abs(reward / risk);
      }, 0);

      return rrSum / tradesWithRR.length;
    }

    case "consistency": {
      // Calculate percentage of profitable days/sessions
      const daysMap = new Map<string, number>();
      trades.forEach((t) => {
        if (!t.closeTime) return;
        const day = new Date(t.closeTime).toISOString().split("T")[0];
        const profit = parseFloat(t.profit || "0");
        daysMap.set(day, (daysMap.get(day) || 0) + profit);
      });

      const profitableDays = Array.from(daysMap.values()).filter(
        (p) => p > 0
      ).length;
      return (profitableDays / daysMap.size) * 100;
    }

    case "tradeCount": {
      return trades.length;
    }

    case "profitFactor": {
      const grossProfit = trades
        .filter((t) => parseFloat(t.profit || "0") > 0)
        .reduce((sum, t) => sum + parseFloat(t.profit || "0"), 0);

      const grossLoss = Math.abs(
        trades
          .filter((t) => parseFloat(t.profit || "0") < 0)
          .reduce((sum, t) => sum + parseFloat(t.profit || "0"), 0)
      );

      return grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    }

    case "avgProfit": {
      const winningTrades = trades.filter(
        (t) => parseFloat(t.profit || "0") > 0
      );
      if (winningTrades.length === 0) return 0;

      const totalProfit = winningTrades.reduce(
        (sum, t) => sum + parseFloat(t.profit || "0"),
        0
      );
      return totalProfit / winningTrades.length;
    }

    case "avgLoss": {
      const losingTrades = trades.filter(
        (t) => parseFloat(t.profit || "0") < 0
      );
      if (losingTrades.length === 0) return 0;

      const totalLoss = losingTrades.reduce(
        (sum, t) => sum + parseFloat(t.profit || "0"),
        0
      );
      return totalLoss / losingTrades.length;
    }

    default:
      return 0;
  }
}

/**
 * Check if a custom goal has been achieved
 */
export function checkGoalAchieved(
  currentValue: number,
  criteria: CustomGoalCriteria
): boolean {
  const { comparator, targetValue, baselineValue } = criteria;

  switch (comparator) {
    case "gt":
      return currentValue > targetValue;
    case "gte":
      return currentValue >= targetValue;
    case "lt":
      return currentValue < targetValue;
    case "lte":
      return currentValue <= targetValue;
    case "eq":
      return currentValue === targetValue;
    case "increase":
      return baselineValue
        ? currentValue >= targetValue && currentValue > baselineValue
        : currentValue >= targetValue;
    case "decrease":
      return baselineValue
        ? currentValue <= targetValue && currentValue < baselineValue
        : currentValue <= targetValue;
    default:
      return false;
  }
}
